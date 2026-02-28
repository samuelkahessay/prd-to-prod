# Ticket Deflection Service

An ASP.NET Core 8 web application that automatically classifies, matches, and resolves support tickets against a knowledge base, reducing manual workload.

## Tech Stack

- **Framework**: ASP.NET Core 8 (Minimal API + Razor Pages)
- **ORM**: Entity Framework Core 8 (InMemory)
- **Language**: C# (.NET 8)
- **Testing**: xUnit + Microsoft.AspNetCore.Mvc.Testing

## Build

```bash
dotnet build
```

## Test

```bash
dotnet test TicketDeflection.sln
```

## Run

```bash
dotnet run --project TicketDeflection/TicketDeflection.csproj
```

The application will start on `http://localhost:5000` (or the port shown in the console).

## Docker

### Build the image

```bash
docker build -t ticket-deflection .
```

### Run the container

```bash
docker run -p 8080:8080 ticket-deflection
```

Then open `http://localhost:8080` in your browser.
