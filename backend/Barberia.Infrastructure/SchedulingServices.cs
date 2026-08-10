using System.Data;
using Barberia.Application;
using Barberia.Domain;
using Microsoft.EntityFrameworkCore;

namespace Barberia.Infrastructure;

public sealed class AvailabilityService(BarberiaDbContext database) : IAvailabilityService
{
    public bool Overlaps(
        DateTime startUtc,
        DateTime endUtc,
        DateTime otherStartUtc,
        DateTime otherEndUtc) =>
        startUtc < otherEndUtc && otherStartUtc < endUtc;

    public async Task<IReadOnlyList<TimeRange>> GetAvailableSlotsAsync(
        Guid barberId,
        Guid serviceId,
        DateOnly date,
        CancellationToken cancellationToken = default)
    {
        var barberExists = await database.BarberProfiles
            .AnyAsync(x => x.Id == barberId && x.IsActive, cancellationToken);
        if (!barberExists)
        {
            throw new BusinessRuleException("The selected barber does not exist or is inactive.");
        }

        var service = await database.BarberServices
            .AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == serviceId && x.IsActive, cancellationToken)
            ?? throw new BusinessRuleException("The selected service does not exist or is inactive.");

        if (service.DurationMinutes < 5)
        {
            throw new BusinessRuleException("The selected service has an invalid duration.");
        }

        var schedules = await database.Schedules
            .AsNoTracking()
            .Where(x => x.BarberId == barberId && x.DayOfWeek == date.DayOfWeek && x.IsActive)
            .OrderBy(x => x.StartTime)
            .ToListAsync(cancellationToken);

        var dayStart = DateTime.SpecifyKind(date.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc);
        var dayEnd = dayStart.AddDays(1);
        var blocks = await database.Blocks.AsNoTracking()
            .Where(x => x.BarberId == barberId && x.StartUtc < dayEnd && x.EndUtc > dayStart)
            .Select(x => new TimeRange(x.StartUtc, x.EndUtc))
            .ToListAsync(cancellationToken);
        var appointments = await database.BookingAppointments.AsNoTracking()
            .Where(x => x.BarberId == barberId
                && x.Status != AppointmentStatus.Cancelled
                && x.StartUtc < dayEnd
                && x.EndUtc > dayStart)
            .Select(x => new TimeRange(x.StartUtc, x.EndUtc))
            .ToListAsync(cancellationToken);

        // Slot length and spacing both follow the selected service duration
        // (e.g. a 60-minute cut offers 09:00, 10:00, 11:00).
        var duration = TimeSpan.FromMinutes(service.DurationMinutes);
        var now = DateTime.UtcNow;
        var slots = new List<TimeRange>();

        foreach (var schedule in schedules)
        {
            var cursor = DateTime.SpecifyKind(date.ToDateTime(schedule.StartTime), DateTimeKind.Utc);
            var scheduleEnd = DateTime.SpecifyKind(date.ToDateTime(schedule.EndTime), DateTimeKind.Utc);
            while (cursor + duration <= scheduleEnd)
            {
                var end = cursor + duration;
                var unavailable = blocks.Concat(appointments)
                    .Any(range => Overlaps(cursor, end, range.StartUtc, range.EndUtc));
                if (cursor > now && !unavailable)
                {
                    slots.Add(new TimeRange(cursor, end));
                }

                cursor = cursor.Add(duration);
            }
        }

        return slots;
    }
}

public sealed class AppointmentService(
    BarberiaDbContext database,
    IAvailabilityService availabilityService) : IAppointmentService
{
    public async Task<Appointment> CreateAsync(
        Guid customerId,
        Guid barberId,
        Guid serviceId,
        DateTime startUtc,
        string? notes,
        CancellationToken cancellationToken = default)
    {
        startUtc = DateTime.SpecifyKind(startUtc.ToUniversalTime(), DateTimeKind.Utc);
        if (startUtc <= DateTime.UtcNow)
        {
            throw new BusinessRuleException("Appointments must be booked in the future.");
        }

        var customerExists = await database.CustomerProfiles
            .AnyAsync(x => x.Id == customerId, cancellationToken);
        if (!customerExists)
        {
            throw new BusinessRuleException("The customer profile does not exist.");
        }

        return await BookSlotAsync(customerId, barberId, serviceId, startUtc, notes, cancellationToken);
    }

    public async Task<Appointment> CreateGuestAsync(
        string fullName,
        string email,
        string documentNumber,
        string? phone,
        Guid barberId,
        Guid serviceId,
        DateTime startUtc,
        string? notes,
        CancellationToken cancellationToken = default)
    {
        startUtc = DateTime.SpecifyKind(startUtc.ToUniversalTime(), DateTimeKind.Utc);
        if (startUtc <= DateTime.UtcNow)
        {
            throw new BusinessRuleException("Appointments must be booked in the future.");
        }

        var normalizedEmail = NormalizeEmail(email);
        var normalizedDocument = NormalizeDocument(documentNumber);
        var normalizedName = fullName.Trim();
        var normalizedPhone = string.IsNullOrWhiteSpace(phone) ? null : phone.Trim();

        if (normalizedName.Length < 2)
        {
            throw new BusinessRuleException("A valid full name is required.");
        }

        if (normalizedDocument.Length < 5)
        {
            throw new BusinessRuleException("A valid document number is required.");
        }

        await using var transaction = await database.Database
            .BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);

        var byEmail = await database.CustomerProfiles
            .SingleOrDefaultAsync(x => x.Email == normalizedEmail, cancellationToken);
        var byDocument = await database.CustomerProfiles
            .SingleOrDefaultAsync(x => x.DocumentNumber == normalizedDocument, cancellationToken);

        if (byEmail is not null && byDocument is not null && byEmail.Id != byDocument.Id)
        {
            throw new BusinessRuleException(
                "The email and document number belong to different customer records.");
        }

        if (byEmail is not null && !string.Equals(byEmail.DocumentNumber, normalizedDocument, StringComparison.Ordinal))
        {
            throw new BusinessRuleException(
                "This email is already registered with a different document number.");
        }

        if (byDocument is not null && !string.Equals(byDocument.Email, normalizedEmail, StringComparison.Ordinal))
        {
            throw new BusinessRuleException(
                "This document number is already registered with a different email.");
        }

        var customer = byEmail ?? byDocument;
        if (customer is null)
        {
            customer = new CustomerProfile
            {
                Email = normalizedEmail,
                DocumentNumber = normalizedDocument,
                FullName = normalizedName,
                Phone = normalizedPhone
            };
            database.CustomerProfiles.Add(customer);
            await database.SaveChangesAsync(cancellationToken);
        }
        else
        {
            customer.FullName = normalizedName;
            customer.Phone = normalizedPhone ?? customer.Phone;
            customer.Email = normalizedEmail;
            customer.DocumentNumber = normalizedDocument;
            await database.SaveChangesAsync(cancellationToken);
        }

        var appointment = await BookSlotAsync(
            customer.Id, barberId, serviceId, startUtc, notes, cancellationToken, useExistingTransaction: true);
        await transaction.CommitAsync(cancellationToken);
        return appointment;
    }

    private async Task<Appointment> BookSlotAsync(
        Guid customerId,
        Guid barberId,
        Guid serviceId,
        DateTime startUtc,
        string? notes,
        CancellationToken cancellationToken,
        bool useExistingTransaction = false)
    {
        Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction? transaction = null;
        if (!useExistingTransaction)
        {
            transaction = await database.Database.BeginTransactionAsync(
                IsolationLevel.Serializable, cancellationToken);
        }

        try
        {
            var slots = await availabilityService.GetAvailableSlotsAsync(
                barberId, serviceId, DateOnly.FromDateTime(startUtc), cancellationToken);
            var selectedSlot = slots.SingleOrDefault(x => x.StartUtc == startUtc)
                ?? throw new BusinessRuleException("The selected time is not available.");

            var appointment = new Appointment
            {
                CustomerId = customerId,
                BarberId = barberId,
                ServiceId = serviceId,
                StartUtc = selectedSlot.StartUtc,
                EndUtc = selectedSlot.EndUtc,
                Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim()
            };
            database.BookingAppointments.Add(appointment);
            await database.SaveChangesAsync(cancellationToken);
            if (transaction is not null)
            {
                await transaction.CommitAsync(cancellationToken);
            }

            return appointment;
        }
        finally
        {
            if (transaction is not null)
            {
                await transaction.DisposeAsync();
            }
        }
    }

    private static string NormalizeEmail(string email) =>
        email.Trim().ToLowerInvariant();

    private static string NormalizeDocument(string documentNumber) =>
        new string(documentNumber.Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();
}
