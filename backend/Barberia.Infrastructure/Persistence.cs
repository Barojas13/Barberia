using Barberia.Application;
using Barberia.Domain;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Barberia.Infrastructure;

public sealed class ApplicationUser : IdentityUser
{
    public string FullName { get; set; } = string.Empty;
}

public sealed class BarberiaDbContext(DbContextOptions<BarberiaDbContext> options)
    : IdentityDbContext<ApplicationUser>(options), IBarberiaRepository
{
    public DbSet<CustomerProfile> CustomerProfiles => Set<CustomerProfile>();
    public DbSet<BarberProfile> BarberProfiles => Set<BarberProfile>();
    public DbSet<BarberService> BarberServices => Set<BarberService>();
    public DbSet<WeeklySchedule> Schedules => Set<WeeklySchedule>();
    public DbSet<ScheduleBlock> Blocks => Set<ScheduleBlock>();
    public DbSet<Appointment> BookingAppointments => Set<Appointment>();

    IQueryable<BarberService> IBarberiaRepository.Services => BarberServices;
    IQueryable<BarberProfile> IBarberiaRepository.Barbers => BarberProfiles;
    IQueryable<CustomerProfile> IBarberiaRepository.Customers => CustomerProfiles;
    IQueryable<WeeklySchedule> IBarberiaRepository.WeeklySchedules => Schedules;
    IQueryable<ScheduleBlock> IBarberiaRepository.ScheduleBlocks => Blocks;
    IQueryable<Appointment> IBarberiaRepository.Appointments => BookingAppointments;

    void IBarberiaRepository.Add<T>(T entity) => Set<T>().Add(entity);

    void IBarberiaRepository.Remove<T>(T entity) => Set<T>().Remove(entity);

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<CustomerProfile>(entity =>
        {
            entity.HasIndex(x => x.UserId).IsUnique();
            entity.HasIndex(x => x.Email).IsUnique();
            entity.HasIndex(x => x.DocumentNumber).IsUnique();
            entity.Property(x => x.Email).HasMaxLength(256);
            entity.Property(x => x.DocumentNumber).HasMaxLength(30);
            entity.Property(x => x.FullName).HasMaxLength(120);
            entity.Property(x => x.Phone).HasMaxLength(30);
        });

        builder.Entity<BarberProfile>(entity =>
        {
            entity.HasIndex(x => x.UserId).IsUnique();
            entity.Property(x => x.DisplayName).HasMaxLength(120);
            entity.Property(x => x.Bio).HasMaxLength(500);
        });

        builder.Entity<BarberService>(entity =>
        {
            entity.Property(x => x.Name).HasMaxLength(100);
            entity.Property(x => x.Description).HasMaxLength(500);
            entity.Property(x => x.Price).HasPrecision(10, 2);
        });

        builder.Entity<WeeklySchedule>()
            .HasIndex(x => new { x.BarberId, x.DayOfWeek });

        builder.Entity<ScheduleBlock>()
            .HasIndex(x => new { x.BarberId, x.StartUtc, x.EndUtc });

        builder.Entity<Appointment>(entity =>
        {
            entity.HasIndex(x => new { x.BarberId, x.StartUtc, x.EndUtc });
            entity.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
            entity.Property(x => x.Notes).HasMaxLength(500);
            entity.HasOne(x => x.Customer).WithMany(x => x.Appointments)
                .HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.Barber).WithMany(x => x.Appointments)
                .HasForeignKey(x => x.BarberId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.Service).WithMany(x => x.Appointments)
                .HasForeignKey(x => x.ServiceId).OnDelete(DeleteBehavior.Restrict);
        });
    }
}
