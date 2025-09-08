from datetime import timedelta
from flask import Blueprint, request, jsonify, make_response, session
from flask_login import current_user, login_user, logout_user
from flask_cors import cross_origin
from models.user import User
from werkzeug.security import check_password_hash

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/debug/session', methods=['GET'])
def debug_session():
    """Debug route to check session status"""
    response_data = {
        'is_authenticated': current_user.is_authenticated,
        'user_id': current_user.id if current_user.is_authenticated else None,
        'username': current_user.user_name if current_user.is_authenticated else None,
        'session_keys': list(session.keys()) if hasattr(session, 'keys') else [],
        'request_headers': dict(request.headers),
        'request_cookies': dict(request.cookies)
    }
    
    response = jsonify(response_data)
    response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response


@auth_bp.route('/api/login', methods=['POST', 'OPTIONS'])
def login():
    if request.method == 'OPTIONS':
        # Handle preflight request
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response
    
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
        login_user(user, remember=True)
        
        # Create response with user data
        response = jsonify({
            'success': True,
            'message': 'Logged in successfully!',
            'user_role': user.role,
            'user_id': user.id,
            'username': user.user_name
        })
        
        # Set CORS headers
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        
        return response
    
    # Authentication failed
    return jsonify({
        'success': False,
        'message': 'Invalid username or password'
    }), 401


@auth_bp.route('/api/check-auth', methods=['GET'])
def check_auth():
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
        return jsonify({'authenticated': False}), 401


@auth_bp.route('/logout', methods=['POST', 'OPTIONS'])
def logout():
    if request.method == 'OPTIONS':
        # Handle preflight request
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response
    
    logout_user()
    
    response = jsonify({
        'success': True,
        'message': 'Logged out successfully',
        'redirect': 'http://localhost:3000/login'
    })
    response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response


@auth_bp.route('/user_status', methods=['GET', 'OPTIONS'])
def user_status():
    if request.method == 'OPTIONS':
        # Handle preflight request
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response
    
    if current_user.is_authenticated:
        response = jsonify({
            'authenticated': True,
            'user': {
                'id': current_user.id,
                'username': current_user.user_name,
                'role': current_user.role
            }
        })
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response
    else:
        response = jsonify({'authenticated': False})
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response
