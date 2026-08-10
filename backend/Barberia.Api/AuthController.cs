using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Barberia.Domain;
using Barberia.Infrastructure;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;

namespace Barberia.Api;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";
    public string Issuer { get; set; } = string.Empty;
    public string Audience { get; set; } = string.Empty;
    public string Key { get; set; } = string.Empty;
    public int ExpirationMinutes { get; set; } = 60;
}

public interface ITokenService
{
    /// <summary>Creates a signed access token for an Identity user.</summary>
    Task<AuthResponse> CreateAsync(ApplicationUser user);
}

public sealed class TokenService(
    UserManager<ApplicationUser> userManager,
    JwtOptions options) : ITokenService
{
    public async Task<AuthResponse> CreateAsync(ApplicationUser user)
    {
        var roles = await userManager.GetRolesAsync(user);
        var expires = DateTime.UtcNow.AddMinutes(options.ExpirationMinutes);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id),
            new(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
            new(ClaimTypes.NameIdentifier, user.Id),
            new(ClaimTypes.Name, user.FullName),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };
        claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));

        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(options.Key)),
            SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            options.Issuer,
            options.Audience,
            claims,
            expires: expires,
            signingCredentials: credentials);

        return new AuthResponse(
            new JwtSecurityTokenHandler().WriteToken(token),
            expires,
            user.Id,
            user.Email ?? string.Empty,
            user.FullName,
            roles.ToArray());
    }
}

[ApiController]
[Route("api/v1/auth")]
public sealed class AuthController(
    UserManager<ApplicationUser> userManager,
    BarberiaDbContext database,
    ITokenService tokenService) : ControllerBase
{
    /// <summary>Registers a customer and returns a JWT access token.</summary>
    [HttpPost("register")]
    [ProducesResponseType<AuthResponse>(StatusCodes.Status201Created)]
    public async Task<ActionResult<AuthResponse>> Register(
        RegisterRequest request,
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
            UserName = email,
            Email = email,
            FullName = request.FullName.Trim(),
            EmailConfirmed = true
        };
        var result = await userManager.CreateAsync(user, request.Password);
        if (!result.Succeeded)
        {
            return ValidationProblem(new ValidationProblemDetails(
                new Dictionary<string, string[]>
                {
                    ["identity"] = result.Errors.Select(x => x.Description).ToArray()
                })
            {
                Title = "Hay errores de validación.",
                Detail = result.Errors.FirstOrDefault()?.Description
                    ?? "Revisa los datos e inténtalo de nuevo."
            });
        }

        await userManager.AddToRoleAsync(user, Roles.Customer);
        var profile = new CustomerProfile
        {
            UserId = user.Id,
            Email = email,
            DocumentNumber = NormalizeDocument(request.DocumentNumber),
            FullName = user.FullName,
            Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim()
        };
        database.CustomerProfiles.Add(profile);
        await database.SaveChangesAsync(cancellationToken);

        return StatusCode(StatusCodes.Status201Created, await tokenService.CreateAsync(user));
    }

    /// <summary>Authenticates an account and returns a JWT access token.</summary>
    [HttpPost("login")]
    [ProducesResponseType<AuthResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request)
    {
        var user = await userManager.FindByEmailAsync(request.Email.Trim());
        if (user is null || !await userManager.CheckPasswordAsync(user, request.Password))
        {
            return Unauthorized(new ProblemDetails
            {
                Title = "Credenciales inválidas",
                Detail = "El correo o la contraseña no son correctos.",
                Status = StatusCodes.Status401Unauthorized
            });
        }

        return Ok(await tokenService.CreateAsync(user));
    }

    private static string NormalizeDocument(string documentNumber) =>
        new string(documentNumber.Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();
}
