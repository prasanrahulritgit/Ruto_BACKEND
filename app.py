from flask import Flask, session
from flask_login import LoginManager
from flask_migrate import Migrate
from models import db, User
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash
from flask_cors import CORS
from apscheduler.schedulers.background import BackgroundScheduler
import os
import shutil
import atexit
from dotenv import load_dotenv

def create_app():
    # Load environment variables first
    load_dotenv()
    
    app = Flask(__name__)
    
    # Configuration - using environment variables
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URI', 'sqlite:///device_list.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'your-very-secret-key-here-change-in-production')
    
    # Session configuration - CRITICAL FOR FLASK-LOGIN
    app.config['SESSION_COOKIE_NAME'] = 'device_manager_session'
    app.config['SESSION_COOKIE_HTTPONLY'] = True
    app.config['SESSION_COOKIE_SECURE'] = False  # Set to True in production with HTTPS
    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'  # Changed back to Lax
    app.config['SESSION_COOKIE_DOMAIN'] = None
    app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=24)
    
    # Configure backup settings
    app.config['BACKUP_DIR'] = os.path.join(os.path.expanduser("~"), "db_backups")
    app.config['BACKUP_RETENTION'] = 5
    
    # Configure CORS
    CORS(app, 
         origins=["http://localhost:3000"],
         supports_credentials=True,
         allow_headers=["Content-Type"],
         methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])
    
    # Initialize extensions
    db.init_app(app)
    
    # Setup Flask-Login
    login_manager = LoginManager(app)
    login_manager.login_view = 'auth.login'
    login_manager.session_protection = "strong"
    
    migrate = Migrate(app, db)
    
    # Register blueprints
    from routes.auth_routes import auth_bp
    from routes.device_routes import device_bp
    from routes.user_routes import user_bp
    from routes.reservation_routes import reservation_bp
    from routes.history_routes import history_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(device_bp)
    app.register_blueprint(user_bp)
    app.register_blueprint(reservation_bp)
    app.register_blueprint(history_bp)
    
    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))
    
    # After request handler
    @app.after_request
    def after_request(response):
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

    # Database backup function with timestamp and retention policy
    def backup_database():
        # Create backup directory if it doesn't exist
        os.makedirs(app.config['BACKUP_DIR'], exist_ok=True)
        
        # Generate timestamped filename
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_filename = f"device_list_backup_{timestamp}.db"
        backup_path = os.path.join(app.config['BACKUP_DIR'], backup_filename)
        
        # Get the path to the current database
        db_path = app.instance_path
        if not os.path.exists(db_path):
            os.makedirs(db_path, exist_ok=True)
        db_path = os.path.join(db_path, 'device_list.db')
        
        try:
            # Only backup if database exists
            if os.path.exists(db_path):
                shutil.copy2(db_path, backup_path)
                app.logger.info(f"Database backed up to {backup_path}")
                
                # Clean up old backups (keep only the most recent N backups)
                backups = []
                for file in os.listdir(app.config['BACKUP_DIR']):
                    if file.startswith('device_list_backup_') and file.endswith('.db'):
                        file_path = os.path.join(app.config['BACKUP_DIR'], file)
                        backups.append((file_path, os.path.getctime(file_path)))
                
                # Sort by creation time (oldest first)
                backups.sort(key=lambda x: x[1])
                
                # Remove oldest backups if we exceed retention limit
                while len(backups) > app.config['BACKUP_RETENTION']:
                    oldest_backup = backups.pop(0)
                    os.remove(oldest_backup[0])
                    app.logger.info(f"Removed old backup: {oldest_backup[0]}")
            else:
                app.logger.warning("Database file not found for backup")
                
        except Exception as e:
            app.logger.error(f"Backup failed: {str(e)}")
    
    # Initialize scheduler only if not in testing mode
    if not os.getenv('TESTING'):
        scheduler = BackgroundScheduler()
        scheduler.add_job(func=backup_database, trigger='interval', minutes=5)
        scheduler.start()
        
        # Shut down the scheduler when exiting the app
        atexit.register(lambda: scheduler.shutdown())

    # Create tables and admin user
    with app.app_context():
        try:
            db.create_all()
            
            # Create admin user if it doesn't exist
            admin_username = os.getenv('ADMIN_USERNAME', 'admin')
            admin_password = os.getenv('ADMIN_PASSWORD', 'admin123')
            
            if not User.query.filter_by(user_name=admin_username).first():
                admin = User(
                    user_name=admin_username,
                    user_ip='127.0.0.1',
                    password_hash=generate_password_hash(admin_password),
                    role='admin',
                    created_at=datetime.utcnow()
                )
                db.session.add(admin)
                db.session.commit()
                app.logger.info("Admin user created successfully")
            
            # Create initial backup if not in testing mode
            if not os.getenv('TESTING'):
                backup_database()
                
        except Exception as e:
            app.logger.error(f"Database initialization failed: {str(e)}")
            # Don't raise in production to allow the app to start
            if os.getenv('FLASK_ENV') == 'development':
                raise

    return app

if __name__ == '__main__':
    app = create_app()
    debug_mode = os.getenv('FLASK_ENV') == 'development'
    app.run(host='0.0.0.0', port=5000, debug=debug_mode)