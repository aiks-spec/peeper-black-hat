from setuptools import setup, find_packages

setup(
    name="osint-lookup-engine",
    version="1.0.0",
    description="FastAPI OSINT Lookup Engine",
    author="OSINT Team",
    packages=find_packages(),
    install_requires=[
        "fastapi==0.104.1",
        "uvicorn[standard]==0.24.0",
        "requests==2.31.0",
        "rich==13.7.0",
    ],
    python_requires=">=3.10",
)
