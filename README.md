# OSINT Lookup Engine - FastAPI

A clean FastAPI application that runs OSINT tools directly from PATH without virtualenv or hardcoded paths.

## Features

- **Email Investigation**: `/osint/email?target=EMAIL` - Runs holehe, ghunt, sherlock, and maigret
- **Username Investigation**: `/osint/username?target=USERNAME` - Runs sherlock and maigret  
- **Health Check**: `/health` - Service status
- **Tool Status**: `/tools/status` - Check availability of all OSINT tools

## API Endpoints

### Email Lookup
```
GET /osint/email?target=example@email.com
```

### Username Lookup  
```
GET /osint/username?target=username
```

### Health Check
```
GET /health
```

### Tool Status
```
GET /tools/status
```

## Installation

### Local Development
```bash
pip install -r requirements.txt
python main.py
```

### Docker
```bash
docker build -t osint-engine .
docker run -p 8000:8000 osint-engine
```

### Render Deployment
1. Push code to GitHub
2. Connect repository to Render
3. Deploy using render.yaml configuration

## OSINT Tools

The application uses these tools (installed via pipx):
- **holehe**: Email breach checking
- **ghunt**: Google account investigation  
- **sherlock**: Username search across social networks
- **maigret**: Username search with additional sources

## Configuration

Set environment variables for GHunt authentication:
- `GHUNT_TOKEN`: OAuth token for GHunt
- `GHUNT_COOKIES_B64`: Base64 encoded cookies (alternative)

## Results

All results are saved as JSON files in the `results/` directory with timestamps for reference.
