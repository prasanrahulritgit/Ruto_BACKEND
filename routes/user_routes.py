from flask import Blueprint, render_template, redirect, url_for, flash, request, jsonify
from flask_login import login_required, current_user
from models.user import User
from models.base import db
from werkzeug.security import generate_password_hash
from datetime import datetime

user_bp = Blueprint('user', __name__)


@user_bp.route('/users/add', methods=['POST'])
def add():
    if current_user.role != 'admin':
        return jsonify({'error': 'You do not have permission to perform this action'}), 403
    
    try:
        # Handle both JSON and form data
        if request.is_json:
            data = request.get_json()
        else:
            data = request.form

        # Validate required fields
        if not data.get('user_name') or not data.get('password'):
            return jsonify({'error': 'Username and password are required'}), 400

        new_user = User(
            user_name=data['user_name'],
            user_ip=data.get('user_ip', ''),
            password_hash=generate_password_hash(data['password']),
            role=data.get('role', 'user'),
            created_at=datetime.utcnow()
        )
        
        db.session.add(new_user)
        db.session.commit()
        
        return jsonify({
            'message': 'User added successfully!',
            'user': {
                'id': new_user.id,
                'user_name': new_user.user_name,
                'user_ip': new_user.user_ip,
                'role': new_user.role
            }
        })
    except Exception as e:
        return jsonify({'error': f'Error adding user: {str(e)}'}), 500
    

@user_bp.route('/users/get/<int:user_id>', methods=['GET'])
@login_required
def get_user(user_id):
    if current_user.role != 'admin':
        return jsonify({'error': 'You do not have permission to view this user'}), 403
        
    try:
        user = User.query.get_or_404(user_id)
        return jsonify({
            'id': user.id,
            'user_name': user.user_name,
            'user_ip': user.user_ip or '',
            'role': user.role
        })
    except Exception as e:
        return jsonify({'error': f'Error fetching user: {str(e)}'}), 500

@user_bp.route('/users/edit/<int:user_id>', methods=['POST'])
@login_required
def edit_user(user_id):
    if current_user.role != 'admin':
        return jsonify({'error': 'You do not have permission to perform this action'}), 403
    
    try:
        user = User.query.get_or_404(user_id)
        
        # Get form data
        user_name = request.form.get('user_name')
        user_ip = request.form.get('user_ip', '')
        role = request.form.get('role')
        password = request.form.get('password', '')
        
        # Validate required fields
        if not user_name:
            return jsonify({'error': 'Username is required'}), 400
        
        # Update user data
        user.user_name = user_name
        user.user_ip = user_ip if user_ip else None
        
        # Update password if provided
        if password:
            # Assuming you have a password hashing method
            user.set_password(password)
        
        # Only allow role change if current user is admin
        if role and role in ['user', 'admin']:
            user.role = role
        
        db.session.commit()
        
        return jsonify({
            'message': 'User updated successfully!',
            'user': {
                'id': user.id,
                'user_name': user.user_name,
                'user_ip': user.user_ip,
                'role': user.role
            }
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error updating user: {str(e)}'}), 500


@user_bp.route('/users/update/<int:user_id>', methods=['POST'])
def update(user_id):
    user = User.query.get_or_404(user_id)
    
    # Check permissions - admin or user editing their own account
    if current_user.role != 'admin' and current_user.id != user_id:
        return jsonify({'error': 'You do not have permission to perform this action'}), 403
    
    try:
        data = request.get_json() or request.form
        user.user_name = data['user_name']
        user.user_ip = data.get('user_ip')
        
        # Only admin can change role
        if current_user.role == 'admin':
            user.role = data.get('role', user.role)
        
        # Only update password if provided
        if data.get('password'):
            user.password_hash = generate_password_hash(data['password'])
        
        db.session.commit()
        return jsonify({
            'message': 'User updated successfully!',
            'user': {
                'id': user.id,
                'user_name': user.user_name,
                'user_ip': user.user_ip,
                'role': user.role
            }
        })
    except Exception as e:
        return jsonify({'error': f'Error updating user: {str(e)}'}), 500

@user_bp.route('/users/delete/<int:user_id>', methods=['POST'])
def delete(user_id):
    if current_user.role != 'admin':
        return jsonify({'error': 'You do not have permission to perform this action'}), 403
    
    try:
        user = User.query.get_or_404(user_id)
        db.session.delete(user)
        db.session.commit()
        return jsonify({'message': 'User deleted successfully!'})
    except Exception as e:
        return jsonify({'error': f'Error deleting user: {str(e)}'}), 500

@user_bp.route('/api/users')
def api_users():
    if current_user.role != 'admin':
        return jsonify({'error': 'You do not have permission to view this data'}), 403
    
    users = User.query.all()
    return jsonify([{
        'id': user.id,
        'user_name': user.user_name,
        'user_ip': user.user_ip,
        'role': user.role
    } for user in users])


@user_bp.route('/api/current-user', methods=['GET'])
@login_required
def get_current_user():
    return jsonify({
        'id': current_user.id,
        'user_name': current_user.user_name,
        'user_ip': current_user.user_ip or '',
        'role': current_user.role,
        'is_authenticated': True
    })
