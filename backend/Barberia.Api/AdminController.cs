using Barberia.Application;
using Barberia.Domain;
using Barberia.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Barberia.Api;

[ApiController]
[Authorize(Roles = Roles.Admin)]
[Route("api/v1/admin")]
public sealed class AdminController(
    BarberiaDbContext database,
    UserManager<ApplicationUser> userManager) : ControllerBase
{
    /// <summary>Lists registered customers with optional search and pagination.</summary>
    [HttpGet("clients")]
    public async Task<ActionResult> ListClients(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
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

        var query = database.CustomerProfiles.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLowerInvariant();
            query = query.Where(x =>
                x.FullName.ToLower().Contains(term)
                || x.Email.ToLower().Contains(term)
                || x.DocumentNumber.ToLower().Contains(term)
                || (x.Phone != null && x.Phone.ToLower().Contains(term)));
        }

        var total = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderBy(x => x.FullName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(customer => new CustomerResponse(
                customer.Id,
                customer.FullName,
                customer.Phone,
                customer.Email,
                customer.DocumentNumber))
            .ToListAsync(cancellationToken);

        return Ok(new PagedResult<CustomerResponse>(items, page, pageSize, total));
    }

    [HttpPost("barbers")]
    public async Task<ActionResult<BarberResponse>> CreateBarber(
        CreateBarberRequest request,
        CancellationToken cancellationToken)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        if (await userManager.FindByEmailAsync(email) is not null)
        {
            return Conflict(new ProblemDetails
            {
                Title = "Correo ya registrado",
                Detail = "Ya existe una cuenta con este correo electrónico.",
                Status = StatusCodes.Status409Conflict
            });
        }

        var user = new ApplicationUser
        {
            Email = email,
            UserName = email,
            EmailConfirmed = true,
            FullName = request.DisplayName.Trim()
        };
        var identityResult = await userManager.CreateAsync(user, request.Password);
        if (!identityResult.Succeeded)
        {
            return ValidationProblem(new ValidationProblemDetails(
                new Dictionary<string, string[]>
                {
                    ["identity"] = identityResult.Errors.Select(x => x.Description).ToArray()
                })
            {
                Title = "Hay errores de validación.",
                Detail = identityResult.Errors.FirstOrDefault()?.Description
                    ?? "Revisa los datos del barbero e inténtalo de nuevo."
            });
        }

        await userManager.AddToRoleAsync(user, Roles.Barber);
        var barber = new BarberProfile
        {
            UserId = user.Id,
            DisplayName = request.DisplayName.Trim(),
            Bio = string.IsNullOrWhiteSpace(request.Bio) ? null : request.Bio.Trim()
        };
        database.BarberProfiles.Add(barber);
        await database.SaveChangesAsync(cancellationToken);
        return Created($"/api/v1/barbers/{barber.Id}",
            new BarberResponse(barber.Id, barber.DisplayName, barber.Bio, barber.IsActive));
    }

    [HttpGet("barbers/{barberId:guid}/schedules")]
    public async Task<ActionResult> GetSchedules(Guid barberId, CancellationToken cancellationToken)
    {
        var schedules = await database.Schedules.AsNoTracking()
            .Where(x => x.BarberId == barberId)
            .OrderBy(x => x.DayOfWeek)
            .Select(x => new
            {
                x.Id,
                x.BarberId,
                DayOfWeek = (int)x.DayOfWeek,
                StartTime = x.StartTime.ToString("HH:mm"),
                EndTime = x.EndTime.ToString("HH:mm"),
                x.IsActive
            })
            .ToListAsync(cancellationToken);
        return Ok(schedules);
    }

    [HttpPost("barbers/{barberId:guid}/schedules")]
    public async Task<ActionResult> CreateSchedule(
        Guid barberId,
        UpsertScheduleRequest request,
        CancellationToken cancellationToken)
    {
        if (request.StartTime >= request.EndTime)
        {
            ModelState.AddModelError("time", "StartTime must be earlier than EndTime.");
            return ValidationProblem(ModelState);
        }
        if (!await database.BarberProfiles.AnyAsync(x => x.Id == barberId, cancellationToken))
        {
            return NotFound();
        }

        var overlaps = await database.Schedules.AnyAsync(x =>
            x.BarberId == barberId
            && x.DayOfWeek == request.DayOfWeek
            && x.IsActive
            && x.StartTime < request.EndTime
            && request.StartTime < x.EndTime,
            cancellationToken);
        if (overlaps)
        {
            return Conflict(new ProblemDetails
            {
                Title = "Schedule overlap",
                Detail = "The schedule overlaps an existing active schedule.",
                Status = StatusCodes.Status409Conflict
            });
        }

        var schedule = new WeeklySchedule
        {
            BarberId = barberId,
            DayOfWeek = request.DayOfWeek,
            StartTime = request.StartTime,
            EndTime = request.EndTime,
            IsActive = request.IsActive
        };
        database.Schedules.Add(schedule);
        await database.SaveChangesAsync(cancellationToken);
        return Created($"/api/v1/admin/barbers/{barberId}/schedules", schedule);
    }

    [HttpDelete("schedules/{id:guid}")]
    public async Task<IActionResult> DeleteSchedule(Guid id, CancellationToken cancellationToken)
    {
        var schedule = await database.Schedules.FindAsync([id], cancellationToken);
        if (schedule is null)
        {
            return NotFound();
        }

        database.Schedules.Remove(schedule);
        await database.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpPost("blocks")]
    public async Task<ActionResult> CreateBlock(
        CreateBlockRequest request,
        CancellationToken cancellationToken)
    {
        var startUtc = request.StartUtc.ToUniversalTime();
        var endUtc = request.EndUtc.ToUniversalTime();
        if (request.BarberId == Guid.Empty || startUtc >= endUtc)
        {
            ModelState.AddModelError("block", "A barber and a valid time range are required.");
            return ValidationProblem(ModelState);
        }
        if (!await database.BarberProfiles.AnyAsync(x => x.Id == request.BarberId, cancellationToken))
        {
            return NotFound();
        }

        var block = new ScheduleBlock
        {
            BarberId = request.BarberId,
            StartUtc = startUtc,
            EndUtc = endUtc,
            Reason = string.IsNullOrWhiteSpace(request.Reason) ? null : request.Reason.Trim()
        };
        database.Blocks.Add(block);
        await database.SaveChangesAsync(cancellationToken);
        return Created($"/api/v1/admin/blocks/{block.Id}", block);
    }

    [HttpDelete("blocks/{id:guid}")]
    public async Task<IActionResult> DeleteBlock(Guid id, CancellationToken cancellationToken)
    {
        var block = await database.Blocks.FindAsync([id], cancellationToken);
        if (block is null)
        {
            return NotFound();
        }

        database.Blocks.Remove(block);
        await database.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}
