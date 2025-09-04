# 🔍 OSINT Lookup Engine

A powerful OSINT (Open Source Intelligence) tool that provides comprehensive information gathering capabilities for emails, phone numbers, usernames, and IP addresses.

## ✨ Features

- **🔍 Email Lookup**: CUFinder API, GHunt, Holehe, Sherlock, Maigret
- **📱 Phone Lookup**: PhoneInfoga, phone-number-api, social media search
- **👤 Username Search**: Sherlock, Maigret across 100+ platforms
- **🌐 IP Geolocation**: IPInfo integration with detailed location data
- **🔄 Real-time Results**: Live data from multiple sources
- **🧹 Auto-cleanup**: Optional (disabled by default)
- **🌍 Cross-platform**: Works on Windows, Linux, and Mac

## 🚀 Live Demo

**Coming Soon** - Will be deployed on Render.com

## 🛠️ Technologies Used

- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL (Render) with SQLite fallback
- **Frontend**: HTML, CSS, JavaScript
- **OSINT Tools**: Sherlock, Maigret, PhoneInfoga, GHunt, Holehe
- **APIs**: CUFinder, IPInfo, Phone-Number-API

## 📋 Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Python 3.8+ (for OSINT tools)

## 🔧 Installation

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/osint-lookup-engine.git
cd osint-lookup-engine
```

### 2. Install Node.js Dependencies
```bash
npm install
```

### 3. Set Up Python Virtual Environment

#### Linux/macOS:
```bash
# Make setup script executable
chmod +x setup_python_env.sh start_with_venv.sh

# Create virtual environment and install Python tools
./setup_python_env.sh
```

#### Windows:
```batch
# Create virtual environment and install Python tools
setup_python_env.bat
```

### 4. Set Environment Variables
Create a `.env` file:
```env
NODE_ENV=development
PORT=3000
CUFINDER_API_KEY=your_cufinder_api_key
IPINFO_TOKEN=your_ipinfo_token
DEHASHED_EMAIL=your_email
DEHASHED_API_KEY=your_api_key
```

### 5. Start the Application

#### Linux/macOS:
```bash
./start_with_venv.sh
```

#### Windows:
```batch
start_with_venv.bat
```

#### Manual Start (if virtual environment is already active):
```bash
npm start
```

The application will be available at `http://localhost:3000`

## 📱 Usage

### Email Lookup
- Enter an email address
- Get comprehensive information including:
  - Personal details (name, company, position)
  - Social media profiles
  - Data breach information
  - Google account details

### Phone Lookup
- Enter a phone number
- Receive information about:
  - Carrier and country
  - Line type and validity
  - Associated social media accounts
  - Location data

### Username Search
- Search for usernames across:
  - Social media platforms
  - Professional networks
  - Gaming platforms
  - And 100+ more sites

### IP Lookup
- Get detailed geolocation information
- ISP and organization details
- Timezone and coordinates

## 🌐 Deployment

### Render.com (Recommended)
The application is configured for automatic deployment on Render.com with Python virtual environment support:

1. Push your code to GitHub
2. Connect your repository to Render.com
3. Set environment variables in Render dashboard
4. Deploy automatically

**Key Features for Render:**
- ✅ Automatic Python virtual environment setup
- ✅ Isolated Python dependencies
- ✅ Pre-configured `render.yaml` for seamless deployment
- ✅ Comprehensive deployment guide in `RENDER_DEPLOYMENT.md`

### Other Platforms
- **Heroku**: Use the Procfile and environment variables
- **Railway**: Connect GitHub repository directly
- **DigitalOcean**: App Platform with automatic deployments
- **Vercel**: Serverless deployment option

## 🐍 Virtual Environment Benefits

The application now uses Python virtual environments for better dependency management:

- **🔒 Dependency Isolation**: Prevents conflicts between system and project Python packages
- **🔄 Reproducible Environment**: Ensures consistent behavior across different systems
- **📦 Easy Management**: Simple setup and cleanup of Python dependencies
- **🚀 Render Compatibility**: Works seamlessly with Render's Node.js environment
- **🛠️ Development Flexibility**: Easy switching between different Python versions and packages

## 🔒 Security Features

- Environment variable protection for API keys
- Automatic file cleanup (30-minute timeout)
- CORS configuration for web access
- No sensitive data logging in production
- Cross-platform security hardening

## 📊 API Endpoints

- `POST /api/email-lookup` - Email intelligence gathering
- `POST /api/phone-lookup` - Phone number analysis
- `POST /api/aggregate` - Multi-source OSINT lookup
- `POST /api/ip-lookup` - IP geolocation
- `GET /api/stats` - Usage statistics

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

This tool is for **educational and legitimate OSINT purposes only**. Users are responsible for complying with applicable laws and terms of service. The developers are not responsible for misuse of this tool.

## 🆘 Support

- **Issues**: Report bugs and feature requests on GitHub
- **Documentation**: Check the [DEPLOYMENT.md](DEPLOYMENT.md) for detailed setup guides
- **Community**: Join our discussions for help and tips

## 🎯 Roadmap

- [ ] Additional OSINT tools integration
- [ ] Advanced analytics dashboard
- [ ] API rate limiting and caching
- [ ] Mobile-responsive improvements
- [ ] Multi-language support

---

**Made with ❤️ for the OSINT community**
