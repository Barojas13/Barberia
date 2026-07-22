using Barberia.Domain;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Barberia.Infrastructure;

public static class DatabaseSeeder
{
    public const string DevelopmentAdminEmail = "admin@barberia.local";
    public const string DevelopmentAdminPassword = "DevAdmin123!";
    public const string DevelopmentBarberEmail = "barber@barberia.local";
    public const string DevelopmentBarberPassword = "DevBarber123!";

    /// <summary>Creates required roles and development reference data idempotently.</summary>
    public static async Task SeedAsync(IServiceProvider services, CancellationToken cancellationToken = default)
    {
        var database = services.GetRequiredService<BarberiaDbContext>();
        await database.Database.MigrateAsync(cancellationToken);

        var roleManager = services.GetRequiredService<RoleManager<IdentityRole>>();
        foreach (var role in new[] { Roles.Admin, Roles.Barber, Roles.Customer })
        {
            if (!await roleManager.RoleExistsAsync(role))
            {
                await roleManager.CreateAsync(new IdentityRole(role));
            }
        }

        var userManager = services.GetRequiredService<UserManager<ApplicationUser>>();
        await EnsureUserAsync(
            userManager, DevelopmentAdminEmail, DevelopmentAdminPassword, "Development Administrator", Roles.Admin);
        var barberUser = await EnsureUserAsync(
            userManager, DevelopmentBarberEmail, DevelopmentBarberPassword, "Alex Barber", Roles.Barber);

        var barber = await database.BarberProfiles
            .SingleOrDefaultAsync(x => x.UserId == barberUser.Id, cancellationToken);
        if (barber is null)
        {
            barber = new BarberProfile
            {
                UserId = barberUser.Id,
                DisplayName = barberUser.FullName,
                Bio = "Experienced professional barber."
            };
            database.BarberProfiles.Add(barber);
            foreach (var day in Enumerable.Range(1, 6).Select(value => (DayOfWeek)value))
            {
                database.Schedules.Add(new WeeklySchedule
                {
                    Barber = barber,
                    DayOfWeek = day,
                    StartTime = new TimeOnly(9, 0),
                    EndTime = new TimeOnly(18, 0)
                });
            }
        }

        if (!await database.BarberServices.AnyAsync(cancellationToken))
        {
            database.BarberServices.AddRange(
                new BarberService
                {
                    Name = "Classic Haircut",
                    Description = "Classic haircut and styling.",
                    DurationMinutes = 30,
                    Price = 25m
                },
                new BarberService
                {
                    Name = "Beard Trim",
                    Description = "Beard shaping and trim.",
                    DurationMinutes = 20,
                    Price = 15m
                },
                new BarberService
                {
                    Name = "Haircut and Beard",
                    Description = "Complete haircut and beard service.",
                    DurationMinutes = 50,
                    Price = 35m
                });
        }

        await database.SaveChangesAsync(cancellationToken);
    }

    private static async Task<ApplicationUser> EnsureUserAsync(
        UserManager<ApplicationUser> userManager,
        string email,
        string password,
        string fullName,
        string role)
    {
        var user = await userManager.FindByEmailAsync(email);
        if (user is null)
        {
            user = new ApplicationUser
            {
                UserName = email,
                Email = email,
                FullName = fullName,
                EmailConfirmed = true
            };
            var result = await userManager.CreateAsync(user, password);
            if (!result.Succeeded)
            {
                throw new InvalidOperationException(
                    $"Could not create seed user: {string.Join(", ", result.Errors.Select(x => x.Description))}");
            }
        }

        if (!await userManager.IsInRoleAsync(user, role))
        {
            await userManager.AddToRoleAsync(user, role);
        }

        return user;
    }
}
