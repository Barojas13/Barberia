using Barberia.Domain;
using Barberia.Infrastructure;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace Barberia.UnitTests;

public sealed class SchedulingRulesTests : IAsyncLifetime
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    private BarberiaDbContext _database = null!;
    private AvailabilityService _service = null!;

    public async Task InitializeAsync()
    {
        await _connection.OpenAsync();
        var options = new DbContextOptionsBuilder<BarberiaDbContext>()
            .UseSqlite(_connection)
            .Options;
        _database = new BarberiaDbContext(options);
        await _database.Database.EnsureCreatedAsync();
        _service = new AvailabilityService(_database);
    }

    public async Task DisposeAsync()
    {
        await _database.DisposeAsync();
        await _connection.DisposeAsync();
    }

    [Fact]
    public void Overlaps_WhenIntervalsTouch_ReturnsFalse()
    {
        var start = new DateTime(2030, 1, 1, 10, 0, 0, DateTimeKind.Utc);

        var overlaps = _service.Overlaps(
            start, start.AddMinutes(30), start.AddMinutes(30), start.AddMinutes(60));

        Assert.False(overlaps);
    }

    [Fact]
    public void Overlaps_WhenIntervalsIntersect_ReturnsTrue()
    {
        var start = new DateTime(2030, 1, 1, 10, 0, 0, DateTimeKind.Utc);

        var overlaps = _service.Overlaps(
            start, start.AddMinutes(30), start.AddMinutes(15), start.AddMinutes(45));

        Assert.True(overlaps);
    }

    [Fact]
    public async Task GetAvailableSlots_ExcludesBlocksAndAppointments()
    {
        var date = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30));
        var barber = new BarberProfile { UserId = "barber-1", DisplayName = "Test Barber" };
        var customer = new CustomerProfile
        {
            UserId = "customer-1",
            Email = "customer@test.local",
            DocumentNumber = "1234567890",
            FullName = "Test Customer"
        };
        var service = new BarberService { Name = "Haircut", DurationMinutes = 30, Price = 20 };
        _database.AddRange(barber, customer, service);
        _database.Schedules.Add(new WeeklySchedule
        {
            Barber = barber,
            DayOfWeek = date.DayOfWeek,
            StartTime = new TimeOnly(9, 0),
            EndTime = new TimeOnly(11, 0)
        });
        var nine = DateTime.SpecifyKind(date.ToDateTime(new TimeOnly(9, 0)), DateTimeKind.Utc);
        _database.Blocks.Add(new ScheduleBlock
        {
            Barber = barber,
            StartUtc = nine.AddMinutes(30),
            EndUtc = nine.AddMinutes(60)
        });
        _database.BookingAppointments.Add(new Appointment
        {
            Barber = barber,
            Customer = customer,
            Service = service,
            StartUtc = nine.AddMinutes(90),
            EndUtc = nine.AddMinutes(120),
            Status = AppointmentStatus.Confirmed
        });
        await _database.SaveChangesAsync();

        var slots = await _service.GetAvailableSlotsAsync(barber.Id, service.Id, date);

        Assert.Contains(slots, x => x.StartUtc == nine);
        Assert.DoesNotContain(slots, x => x.StartUtc == nine.AddMinutes(30));
        Assert.DoesNotContain(slots, x => x.StartUtc == nine.AddMinutes(90));
    }
}
