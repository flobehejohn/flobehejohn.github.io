using GestionCommandesAPI.Data;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var builder = WebApplication.CreateBuilder(args);

// =====================================================
// CORS sécurisé : autorise tous tes frontends dev/prod
// (ajoute ici tout domaine supplémentaire si besoin)
// =====================================================
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
        policy
            .WithOrigins(
                "http://localhost:5173",           // Vite/Vue.js dev
                "http://localhost:3000",           // React dev
                "http://localhost:5500",           // Live Server/Python local (localhost)
                "http://127.0.0.1:5500",           // Live Server/Python local (127.0.0.1)
                "http://127.0.0.1:5173",           // Vite/Vue.js dev (127.0.0.1)
                "http://127.0.0.1:3000",           // React dev (127.0.0.1)
                "https://dotnet-8zr.pages.dev",    // Cloudflare Pages (prod)
                "https://flobehejohn.github.io"    // (exemple) GitHub Pages (prod)
                // ➕ Ajoute d'autres domaines front si besoin (ex : staging)
            )
            .AllowAnyHeader()
            .AllowAnyMethod()
            // .AllowCredentials() // Dé-commente si tu utilises des cookies/sessions cross-domain
    );
});

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// =====================================================
// Pipeline ASP.NET Core moderne (ordre crucial !)
// =====================================================

// Doit être AVANT CORS
app.UseRouting();

// Place ici la politique CORS définie ci-dessus
app.UseCors("AllowFrontend");

app.UseAuthorization();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Mappe automatiquement les controllers REST
app.MapControllers();

Console.WriteLine("✅ API .NET lancée avec CORS pour le front sur tous les ports utiles !");

// Lancer l’application
app.Run();
