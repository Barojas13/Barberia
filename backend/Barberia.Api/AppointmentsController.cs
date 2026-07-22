using System.Security.Claims;
using Barberia.Application;
using Barberia.Domain;
using Barberia.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Barberia.Api;

[ApiController]
[Authorize]
[Route("api/v1/appointments")]
public sealed class AppointmentsController(
    BarberiaDbContext database,
    IAppointmentService appointmentService) : ControllerBase
{
    [Authorize(Roles = Roles.Customer)]
    [HttpPost]
    public async Task<ActionResult<AppointmentResponse>> Create(
        CreateAppointmentRequest request,
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

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var customer = await database.CustomerProfiles
            .SingleOrDefaultAsync(x => x.UserId == userId, cancellationToken);
        if (customer is null)
        {
            return Forbid();
        }

        var appointment = await appointmentService.CreateAsync(
            customer.Id,
            request.BarberId,
            request.ServiceId,
            request.StartUtc,
            request.Notes,
            cancellationToken);
        var response = await ToResponses(AuthorizedAppointments().Where(x => x.Id == appointment.Id))
            .SingleAsync(cancellationToken);
        return CreatedAtAction(nameof(Get), new { id = appointment.Id }, response);
    }

    [HttpGet]
    public async Task<ActionResult<PagedResult<AppointmentResponse>>> List(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] AppointmentStatus? status = null,
        [FromQuery] Guid? barberId = null,
        [FromQuery] DateOnly? from = null,
        [FromQuery] DateOnly? to = null,
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

        var query = AuthorizedAppointments();
        if (status.HasValue)
        {
            query = query.Where(x => x.Status == status.Value);
        }
        if (barberId.HasValue)
        {
            query = query.Where(x => x.BarberId == barberId.Value);
        }
        if (from.HasValue)
        {
            var start = DateTime.SpecifyKind(from.Value.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc);
            query = query.Where(x => x.StartUtc >= start);
        }
        if (to.HasValue)
        {
            var end = DateTime.SpecifyKind(to.Value.AddDays(1).ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc);
            query = query.Where(x => x.StartUtc < end);
        }

        var total = await query.CountAsync(cancellationToken);
        var items = await ToResponses(query.OrderByDescending(x => x.StartUtc))
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);
        return Ok(new PagedResult<AppointmentResponse>(items, page, pageSize, total));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<AppointmentResponse>> Get(Guid id, CancellationToken cancellationToken)
    {
        var response = await ToResponses(AuthorizedAppointments().Where(x => x.Id == id))
            .SingleOrDefaultAsync(cancellationToken);
        return response is null ? NotFound() : Ok(response);
    }

    [HttpPatch("{id:guid}/status")]
    public async Task<ActionResult<AppointmentResponse>> UpdateStatus(
        Guid id,
        UpdateAppointmentStatusRequest request,
        CancellationToken cancellationToken)
    {
        var appointment = await AuthorizedAppointments().SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (appointment is null)
        {
            return NotFound();
        }

        var isCustomer = User.IsInRole(Roles.Customer);
        if (isCustomer && request.Status != AppointmentStatus.Cancelled)
        {
            return Forbid();
        }
        if (!CanTransition(appointment.Status, request.Status))
        {
            return Conflict(new ProblemDetails
            {
                Title = "Invalid status transition",
                Detail = $"An appointment cannot change from {appointment.Status} to {request.Status}.",
                Status = StatusCodes.Status409Conflict
            });
        }

        appointment.Status = request.Status;
        await database.SaveChangesAsync(cancellationToken);
        return Ok(await ToResponses(AuthorizedAppointments().Where(x => x.Id == id))
            .SingleAsync(cancellationToken));
    }

    private IQueryable<Appointment> AuthorizedAppointments()
    {
        var query = database.BookingAppointments.AsQueryable();
        if (User.IsInRole(Roles.Admin))
        {
            return query;
        }

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (User.IsInRole(Roles.Barber))
        {
            return query.Where(x => x.Barber.UserId == userId);
        }

        return query.Where(x => x.Customer.UserId == userId);
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

    private static bool CanTransition(AppointmentStatus current, AppointmentStatus next) =>
        current switch
        {
            AppointmentStatus.Pending => next is AppointmentStatus.Confirmed or AppointmentStatus.Cancelled,
            AppointmentStatus.Confirmed => next is AppointmentStatus.Completed or AppointmentStatus.Cancelled,
            _ => false
        };
}
