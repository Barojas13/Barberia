using Barberia.Domain;

namespace Barberia.Application;

public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalCount);

public sealed record TimeRange(DateTime StartUtc, DateTime EndUtc);

public interface IBarberiaRepository
{
    IQueryable<BarberService> Services { get; }
    IQueryable<BarberProfile> Barbers { get; }
    IQueryable<CustomerProfile> Customers { get; }
    IQueryable<WeeklySchedule> WeeklySchedules { get; }
    IQueryable<ScheduleBlock> ScheduleBlocks { get; }
    IQueryable<Appointment> Appointments { get; }
    void Add<T>(T entity) where T : class;
    void Remove<T>(T entity) where T : class;
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}

public interface IAvailabilityService
{
    /// <summary>Calculates bookable UTC slots for a barber, service, and calendar date.</summary>
    Task<IReadOnlyList<TimeRange>> GetAvailableSlotsAsync(
        Guid barberId,
        Guid serviceId,
        DateOnly date,
        CancellationToken cancellationToken = default);

    /// <summary>Determines whether a proposed interval conflicts with another interval.</summary>
    bool Overlaps(DateTime startUtc, DateTime endUtc, DateTime otherStartUtc, DateTime otherEndUtc);
}

public interface IAppointmentService
{
    /// <summary>Creates an appointment after validating schedule and collision rules.</summary>
    Task<Appointment> CreateAsync(
        Guid customerId,
        Guid barberId,
        Guid serviceId,
        DateTime startUtc,
        string? notes,
        CancellationToken cancellationToken = default);

    /// <summary>Creates or reuses a guest customer by email/document and books an appointment.</summary>
    Task<Appointment> CreateGuestAsync(
        string fullName,
        string email,
        string documentNumber,
        string? phone,
        Guid barberId,
        Guid serviceId,
        DateTime startUtc,
        string? notes,
        CancellationToken cancellationToken = default);
}

public sealed class BusinessRuleException(string message) : Exception(message);
