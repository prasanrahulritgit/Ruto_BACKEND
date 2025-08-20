from datetime import datetime
from flask import Blueprint, render_template, redirect, url_for, flash, request, jsonify
from flask_login import current_user, login_user, logout_user, login_required
from models.user import User
from models.base import db
from werkzeug.security import check_password_hash, generate_password_hash
from forms import LoginForm
from flask_wtf.csrf import generate_csrf

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    # Expect JSON data from React frontend
    if not request.is_json:
        return jsonify({
            'success': False,
            'message': 'Request must be JSON'
        }), 400
    
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    # Validate input
    if not username or not password:
        return jsonify({
            'success': False,
            'message': 'Username and password are required'
        }), 400
    
    # Find user and validate credentials
    user = User.query.filter_by(user_name=username).first()
    
    if user and check_password_hash(user.password_hash, password):
        login_user(user)
        
        # Determine redirect URL based on user role
        if user.role == 'admin':
            redirect_url = 'http://localhost:3000/admin_dashboard'
        else:
            redirect_url = 'http://localhost:3000/user_reservation'
        
        return jsonify({
            'success': True,
            'message': 'Logged in successfully!',
            'redirect': redirect_url,
            'user_role': user.role,
            'user_id': user.id,
            'username': user.user_name
        })
    
    # Authentication failed
    return jsonify({
        'success': False,
        'message': 'Invalid username or password'
    }), 401


@auth_bp.route('/logout', methods=['POST'])
def logout():
    logout_user()
    
    return jsonify({
        'success': True,
        'message': 'Logged out successfully',
        'redirect': 'http://localhost:3000/login'
    })


@auth_bp.route('/user_status', methods=['GET'])
def user_status():
    if current_user.is_authenticated:
        return jsonify({
            'authenticated': True,
            'user': {
                'id': current_user.id,
                'username': current_user.user_name,
                'role': current_user.role
            }
        })
    else:
        return jsonify({'authenticated': False})