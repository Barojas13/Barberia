namespace Barberia.Domain;

public enum AppointmentStatus
{
    Pending,
    Confirmed,
    Completed,
    Cancelled
}

public static class Roles
{
    public const string Admin = "Admin";
    public const string Barber = "Barber";
    public const string Customer = "Customer";
}

public abstract class Entity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

/// <summary>Customer identity for bookings; email is the primary business key.</summary>
public sealed class CustomerProfile : Entity
{
    public string? UserId { get; set; }
    public required string Email { get; set; }
    public required string DocumentNumber { get; set; }
    public required string FullName { get; set; }
    public string? Phone { get; set; }
    public ICollection<Appointment> Appointments { get; set; } = [];
}

public sealed class BarberProfile : Entity
{
    public required string UserId { get; set; }
    public required string DisplayName { get; set; }
    public string? Bio { get; set; }
    public bool IsActive { get; set; } = true;
    public ICollection<WeeklySchedule> WeeklySchedules { get; set; } = [];
    public ICollection<ScheduleBlock> ScheduleBlocks { get; set; } = [];
    public ICollection<Appointment> Appointments { get; set; } = [];
}

public sealed class BarberService : Entity
{
    public required string Name { get; set; }
    public string? Description { get; set; }
    public int DurationMinutes { get; set; }
    public decimal Price { get; set; }
    public bool IsActive { get; set; } = true;
    public ICollection<Appointment> Appointments { get; set; } = [];
}

public sealed class WeeklySchedule : Entity
{
    public Guid BarberId { get; set; }
    public BarberProfile Barber { get; set; } = null!;
    public DayOfWeek DayOfWeek { get; set; }
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class ScheduleBlock : Entity
{
    public Guid BarberId { get; set; }
    public BarberProfile Barber { get; set; } = null!;
    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }
    public string? Reason { get; set; }
}

public sealed class Appointment : Entity
{
    public Guid BarberId { get; set; }
    public BarberProfile Barber { get; set; } = null!;
    public Guid CustomerId { get; set; }
    public CustomerProfile Customer { get; set; } = null!;
    public Guid ServiceId { get; set; }
    public BarberService Service { get; set; } = null!;
    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }
    public AppointmentStatus Status { get; set; } = AppointmentStatus.Pending;
    public string? Notes { get; set; }
}
