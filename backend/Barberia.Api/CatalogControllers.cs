using Barberia.Application;
using Barberia.Domain;
using Barberia.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Barberia.Api;

[ApiController]
[Route("api/v1/services")]
public sealed class ServicesController(BarberiaDbContext database) : ControllerBase
{
    /// <summary>Lists services with pagination and optional active-state filtering.</summary>
    [HttpGet]
    public async Task<ActionResult<PagedResult<ServiceResponse>>> List(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] bool? active = true,
        CancellationToken cancellationToken = default)
    {
        if (page < 1 || pageSize is < 1 or > 100)
        {
            ModelState.AddModelError("pagination", "Page must be positive and pageSize must be between 1 and 100.");
            return ValidationProblem(ModelState);
        }

        var query = database.BarberServices.AsNoTracking();
        if (active.HasValue)
        {
            query = query.Where(x => x.IsActive == active.Value);
        }

        var total = await query.CountAsync(cancellationToken);
        var items = await query.OrderBy(x => x.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new ServiceResponse(
                x.Id, x.Name, x.Description, x.DurationMinutes, x.Price, x.IsActive))
            .ToListAsync(cancellationToken);
        return Ok(new PagedResult<ServiceResponse>(items, page, pageSize, total));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ServiceResponse>> Get(Guid id, CancellationToken cancellationToken)
    {
        var item = await database.BarberServices.AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new ServiceResponse(
                x.Id, x.Name, x.Description, x.DurationMinutes, x.Price, x.IsActive))
            .SingleOrDefaultAsync(cancellationToken);
        return item is null ? NotFound() : Ok(item);
    }

    [Authorize(Roles = Roles.Admin)]
    [HttpPost]
    public async Task<ActionResult<ServiceResponse>> Create(
        UpsertServiceRequest request,
        CancellationToken cancellationToken)
    {
        var service = Map(request);
        database.BarberServices.Add(service);
        await database.SaveChangesAsync(cancellationToken);
        var response = ToResponse(service);
        return CreatedAtAction(nameof(Get), new { id = service.Id }, response);
    }

    [Authorize(Roles = Roles.Admin)]
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ServiceResponse>> Update(
        Guid id,
        UpsertServiceRequest request,
        CancellationToken cancellationToken)
    {
        var service = await database.BarberServices.FindAsync([id], cancellationToken);
        if (service is null)
        {
            return NotFound();
        }

        service.Name = request.Name.Trim();
        service.Description = Normalize(request.Description);
        service.DurationMinutes = request.DurationMinutes;
        service.Price = request.Price;
        service.IsActive = request.IsActive;
        await database.SaveChangesAsync(cancellationToken);
        return Ok(ToResponse(service));
    }

    [Authorize(Roles = Roles.Admin)]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var service = await database.BarberServices.FindAsync([id], cancellationToken);
        if (service is null)
        {
            return NotFound();
        }

        service.IsActive = false;
        await database.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private static BarberService Map(UpsertServiceRequest request) => new()
    {
        Name = request.Name.Trim(),
        Description = Normalize(request.Description),
        DurationMinutes = request.DurationMinutes,
        Price = request.Price,
        IsActive = request.IsActive
    };

    private static ServiceResponse ToResponse(BarberService service) =>
        new(service.Id, service.Name, service.Description, service.DurationMinutes, service.Price, service.IsActive);

    private static string? Normalize(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}

[ApiController]
[Route("api/v1/barbers")]
public sealed class BarbersController(BarberiaDbContext database) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<BarberResponse>>> List(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
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

        var query = database.BarberProfiles.AsNoTracking().Where(x => x.IsActive);
        var total = await query.CountAsync(cancellationToken);
        var items = await query.OrderBy(x => x.DisplayName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new BarberResponse(x.Id, x.DisplayName, x.Bio, x.IsActive))
            .ToListAsync(cancellationToken);
        return Ok(new PagedResult<BarberResponse>(items, page, pageSize, total));
    }
}

[ApiController]
[Route("api/v1/availability")]
public sealed class AvailabilityController(IAvailabilityService availabilityService) : ControllerBase
{
    /// <summary>Returns available UTC appointment slots for a date.</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AvailabilityResponse>>> Get(
        [FromQuery] Guid barberId,
        [FromQuery] Guid serviceId,
        [FromQuery] DateOnly date,
        CancellationToken cancellationToken)
    {
        if (barberId == Guid.Empty || serviceId == Guid.Empty)
        {
            return BadRequest(new ProblemDetails
            {
                Title = "Invalid identifiers",
                Detail = "barberId and serviceId are required.",
                Status = StatusCodes.Status400BadRequest
            });
        }

        var slots = await availabilityService.GetAvailableSlotsAsync(
            barberId, serviceId, date, cancellationToken);
        return Ok(slots.Select(x => new AvailabilityResponse(x.StartUtc, x.EndUtc)));
    }
}
