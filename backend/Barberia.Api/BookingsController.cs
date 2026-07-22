using System.ComponentModel.DataAnnotations;
using Barberia.Application;
using Barberia.Domain;
using Barberia.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Barberia.Api;

/// <summary>Public booking endpoints that do not require an account.</summary>
[ApiController]
[AllowAnonymous]
[Route("api/v1/bookings")]
public sealed class BookingsController(
    BarberiaDbContext database,
    IAppointmentService appointmentService) : ControllerBase
{
    /// <summary>Creates a guest appointment using email as the customer key.</summary>
    [HttpPost]
    [ProducesResponseType<AppointmentResponse>(StatusCodes.Status201Created)]
    public async Task<ActionResult<AppointmentResponse>> Create(
        CreateGuestAppointmentRequest request,
        CancellationToken cancellationToken)
    {
        if (request.BarberId == Guid.Empty || request.ServiceId == Guid.Empty)
        {
            return BadRequest(new ProblemDetails
            {
                Title = "Invalid identifiers",
                Detail = "BarberId and ServiceId are required.",
                Status = StatusCodes.Status400BadRequest
            });
        }

        var appointment = await appointmentService.CreateGuestAsync(
            request.FullName,
            request.Email,
            request.DocumentNumber,
            request.Phone,
            request.BarberId,
            request.ServiceId,
            request.StartUtc,
            request.Notes,
            cancellationToken);

        var response = await ToResponses(database.BookingAppointments.Where(x => x.Id == appointment.Id))
            .SingleAsync(cancellationToken);
        return CreatedAtAction(nameof(ListMine), new { email = response.CustomerEmail, documentNumber = response.CustomerDocumentNumber }, response);
    }

    /// <summary>Lists appointments for a guest identified by email and document number.</summary>
    [HttpGet]
    public async Task<ActionResult<PagedResult<AppointmentResponse>>> ListMine(
        [FromQuery, EmailAddress] string email,
        [FromQuery] string documentNumber,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        if (page < 1 || pageSize is < 1 or > 100)
        {
            return BadRequest(new ProblemDetails
            {
                Title = "Invalid pagination",
                Detail = "Page must be positive and pageSize must be between 1 and 100.",
                Status = StatusCodes.Status400BadRequest
            });
        }

        var normalizedEmail = email.Trim().ToLowerInvariant();
        var normalizedDocument = NormalizeDocument(documentNumber);
        var customer = await database.CustomerProfiles.AsNoTracking()
            .SingleOrDefaultAsync(
                x => x.Email == normalizedEmail && x.DocumentNumber == normalizedDocument,
                cancellationToken);
        if (customer is null)
        {
            return Ok(new PagedResult<AppointmentResponse>([], page, pageSize, 0));
        }

        var query = database.BookingAppointments.AsNoTracking()
            .Where(x => x.CustomerId == customer.Id);
        var total = await query.CountAsync(cancellationToken);
        var items = await ToResponses(query.OrderByDescending(x => x.StartUtc))
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);
        return Ok(new PagedResult<AppointmentResponse>(items, page, pageSize, total));
    }

    /// <summary>Cancels a guest appointment after verifying email and document ownership.</summary>
    [HttpPost("{id:guid}/cancel")]
    public async Task<ActionResult<AppointmentResponse>> Cancel(
        Guid id,
        [FromQuery, EmailAddress] string email,
        [FromQuery] string documentNumber,
        CancellationToken cancellationToken)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();
        var normalizedDocument = NormalizeDocument(documentNumber);
        var appointment = await database.BookingAppointments
            .Include(x => x.Customer)
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (appointment is null
            || !string.Equals(appointment.Customer.Email, normalizedEmail, StringComparison.Ordinal)
            || !string.Equals(appointment.Customer.DocumentNumber, normalizedDocument, StringComparison.Ordinal))
        {
            return NotFound();
        }

        if (appointment.Status is AppointmentStatus.Completed or AppointmentStatus.Cancelled)
        {
            return Conflict(new ProblemDetails
            {
                Title = "Invalid status transition",
                Detail = $"An appointment cannot change from {appointment.Status} to Cancelled.",
                Status = StatusCodes.Status409Conflict
            });
        }

        appointment.Status = AppointmentStatus.Cancelled;
        await database.SaveChangesAsync(cancellationToken);
        var response = await ToResponses(database.BookingAppointments.Where(x => x.Id == id))
            .SingleAsync(cancellationToken);
        return Ok(response);
    }

    private static IQueryable<AppointmentResponse> ToResponses(IQueryable<Appointment> query) =>
        query.Select(x => new AppointmentResponse(
            x.Id,
            x.BarberId,
            x.Barber.DisplayName,
            x.CustomerId,
            x.Customer.FullName,
            x.Customer.Email,
            x.Customer.DocumentNumber,
            x.ServiceId,
            x.Service.Name,
            x.StartUtc,
            x.EndUtc,
            x.Status,
            x.Notes));

    private static string NormalizeDocument(string documentNumber) =>
        new string(documentNumber.Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();
}
