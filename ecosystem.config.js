module.exports = {
  apps: [
    {
      name: "backend",
      script: "./venv/bin/gunicorn",
      args: "-w 4 -b 127.0.0.1:5000 app:app",
      cwd: "/home/ubuntu/backend/Ruto_BACKEND",
      interpreter: "none",   // important! prevents PM2 from using Node.js
    }
  ]
}

