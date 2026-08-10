using System.ComponentModel.DataAnnotations;
using Barberia.Domain;

namespace Barberia.Api;

public sealed record RegisterRequest(
    [Required, EmailAddress, StringLength(256)] string Email,
    [Required, MinLength(8), MaxLength(100)] string Password,
    [Required, StringLength(120, MinimumLength = 2)] string FullName,
    [Required, StringLength(30, MinimumLength = 5)] string DocumentNumber,
    [Phone, StringLength(30)] string? Phone);

public sealed record LoginRequest(
    [Required, EmailAddress] string Email,
    [Required] string Password);

public sealed record AuthResponse(
    string AccessToken,
    DateTime ExpiresAtUtc,
    string UserId,
    string Email,
    string FullName,
    IReadOnlyList<string> Roles);

public sealed record ServiceResponse(
    Guid Id,
    string Name,
    string? Description,
    int DurationMinutes,
    decimal Price,
    bool IsActive);

public sealed record UpsertServiceRequest(
    [Required, StringLength(100, MinimumLength = 2)] string Name,
    [StringLength(500)] string? Description,
    [Range(5, 480)] int DurationMinutes,
    [Range(typeof(decimal), "0.01", "100000")] decimal Price,
    bool IsActive = true);

public sealed record BarberResponse(Guid Id, string DisplayName, string? Bio, bool IsActive);

public sealed record AvailabilityResponse(DateTime StartUtc, DateTime EndUtc);

public sealed record CreateAppointmentRequest(
    Guid BarberId,
    Guid ServiceId,
    DateTime StartUtc,
    [StringLength(500)] string? Notes);

public sealed record CreateGuestAppointmentRequest(
    [Required, StringLength(120, MinimumLength = 2)] string FullName,
    [Required, EmailAddress, StringLength(256)] string Email,
    [Required, StringLength(30, MinimumLength = 5)] string DocumentNumber,
    [Phone, StringLength(30)] string? Phone,
    Guid BarberId,
    Guid ServiceId,
    DateTime StartUtc,
    [StringLength(500)] string? Notes);

public sealed record AppointmentResponse(
    Guid Id,
    Guid BarberId,
    string BarberName,
    Guid CustomerId,
    string CustomerName,
    string CustomerEmail,
    string CustomerDocumentNumber,
    Guid ServiceId,
    string ServiceName,
    DateTime StartUtc,
    DateTime EndUtc,
    AppointmentStatus Status,
    string? Notes);

public sealed record CustomerResponse(
    Guid Id,
    string FullName,
    string? Phone,
    string Email,
    string DocumentNumber);

public sealed record UpdateAppointmentStatusRequest(AppointmentStatus Status);

public sealed record UpsertScheduleRequest(
    DayOfWeek DayOfWeek,
    TimeOnly StartTime,
    TimeOnly EndTime,
    bool IsActive = true);

public sealed record CreateBlockRequest(
    Guid BarberId,
    DateTime StartUtc,
    DateTime EndUtc,
    [StringLength(300)] string? Reason);

public sealed record CreateBarberRequest(
    [Required, EmailAddress, StringLength(256)] string Email,
    [Required, MinLength(8), MaxLength(100)] string Password,
    [Required, StringLength(120, MinimumLength = 2)] string DisplayName,
    [StringLength(500)] string? Bio);

public sealed record SetBarberStatusRequest(bool IsActive);
