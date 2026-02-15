"""
Authentication Routes
Handles user registration, login, and social OAuth
"""

import os
from datetime import datetime, timedelta
from functools import wraps
from flask import Blueprint, jsonify, request, redirect
import jwt
import requests

from models import db, User, SocialToken

auth_bp = Blueprint('auth', __name__)

# JWT Configuration
JWT_SECRET = os.getenv('JWT_SECRET', 'your-super-secret-jwt-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRY_HOURS = 24 * 7  # 1 week

# OAuth Configuration
TWITTER_CLIENT_ID = os.getenv('TWITTER_CLIENT_ID', '')
TWITTER_CLIENT_SECRET = os.getenv('TWITTER_CLIENT_SECRET', '')
TWITTER_REDIRECT_URI = os.getenv('TWITTER_REDIRECT_URI', 'http://127.0.0.1:3000/callback/twitter')

LINKEDIN_CLIENT_ID = os.getenv('LINKEDIN_CLIENT_ID', '')
LINKEDIN_CLIENT_SECRET = os.getenv('LINKEDIN_CLIENT_SECRET', '')
LINKEDIN_REDIRECT_URI = os.getenv('LINKEDIN_REDIRECT_URI', 'http://127.0.0.1:3000/callback/linkedin')

# OneDrive / Microsoft Graph Configuration
ONEDRIVE_CLIENT_ID = os.getenv('ONEDRIVE_CLIENT_ID', '')
ONEDRIVE_CLIENT_SECRET = os.getenv('ONEDRIVE_CLIENT_SECRET', '')
ONEDRIVE_REDIRECT_URI = os.getenv('ONEDRIVE_REDIRECT_URI', 'http://127.0.0.1:3000/callback/onedrive')

# Evernote Configuration (Production/Sandbox URLs handled in routes)
EVERNOTE_CONSUMER_KEY = os.getenv('EVERNOTE_CONSUMER_KEY', '')
EVERNOTE_CONSUMER_SECRET = os.getenv('EVERNOTE_CONSUMER_SECRET', '')
EVERNOTE_REDIRECT_URI = os.getenv('EVERNOTE_REDIRECT_URI', 'http://127.0.0.1:3000/callback/evernote')


def create_jwt_token(user_id):
    """Create a JWT token for a user."""
    payload = {
        'user_id': user_id,
        'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRY_HOURS),
        'iat': datetime.utcnow()
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_jwt_token(token):
    """Decode and verify a JWT token."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def get_current_user():
    """Get the current authenticated user from the request."""
    auth_header = request.headers.get('Authorization', '')
    
    if not auth_header.startswith('Bearer '):
        return None
    
    token = auth_header[7:]  # Remove 'Bearer ' prefix
    payload = decode_jwt_token(token)
    
    if not payload:
        return None
    
    return User.query.get(payload['user_id'])


def require_auth(f):
    """Decorator to require authentication for a route."""
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Authentication required'}), 401
        return f(user, *args, **kwargs)
    return decorated


# ============ Registration & Login ============

@auth_bp.route('/register', methods=['POST'])
def register():
    """Register a new user."""
    data = request.get_json()
    
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    name = data.get('name', '').strip()
    
    # Validation
    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400
    
    if len(password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400
    
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already registered'}), 409
    
    # Create user
    user = User(email=email, name=name)
    user.set_password(password)
    
    db.session.add(user)
    db.session.commit()
    
    # Generate token
    token = create_jwt_token(user.id)
    
    return jsonify({
        'message': 'Registration successful',
        'token': token,
        'user': user.to_dict()
    }), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    """Login an existing user."""
    data = request.get_json()
    
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    
    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400
    
    user = User.query.filter_by(email=email).first()
    
    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid email or password'}), 401
    
    # Generate token
    token = create_jwt_token(user.id)
    
    return jsonify({
        'message': 'Login successful',
        'token': token,
        'user': user.to_dict()
    })


@auth_bp.route('/me', methods=['GET'])
@require_auth
def get_me(user):
    """Get current user's profile."""
    return jsonify({'user': user.to_dict()})


@auth_bp.route('/profile', methods=['PUT'])
@require_auth
def update_profile(user):
    """Update user's profile."""
    data = request.get_json()
    
    if 'name' in data:
        user.name = data['name'].strip()
    if 'bio' in data:
        user.bio = data['bio'].strip()
    if 'tagline' in data:
        user.tagline = data['tagline'].strip()
    if 'profile_image' in data:
        user.profile_image = data['profile_image']
    
    db.session.commit()
    
    return jsonify({
        'message': 'Profile updated',
        'user': user.to_dict()
    })


@auth_bp.route('/api-keys', methods=['PUT'])
@require_auth
def update_api_keys(user):
    """Update user's AI API keys."""
    data = request.get_json()
    
    # Note: In production, encrypt these keys!
    if 'gemini_api_key' in data:
        user.gemini_api_key = data['gemini_api_key']
    if 'claude_api_key' in data:
        user.claude_api_key = data['claude_api_key']
    if 'deepseek_api_key' in data:
        user.deepseek_api_key = data['deepseek_api_key']
    if 'qwen_api_key' in data:
        user.qwen_api_key = data['qwen_api_key']
    
    db.session.commit()
    
    return jsonify({
        'message': 'API keys updated',
        'user': user.to_dict()
    })


# ============ Social OAuth - Twitter ============

@auth_bp.route('/twitter/connect', methods=['GET'])
@require_auth
def twitter_connect(user):
    """Initiate Twitter OAuth 2.0 flow."""
    if not TWITTER_CLIENT_ID:
        return jsonify({
            'error': 'Twitter OAuth not configured',
            'message': 'Set TWITTER_CLIENT_ID and TWITTER_CLIENT_SECRET'
        }), 400
    
    # Build state parameter (encode user ID)
    state = jwt.encode({'user_id': user.id}, JWT_SECRET, algorithm=JWT_ALGORITHM)
    
    # Twitter OAuth 2.0 authorization URL
    auth_url = (
        f"https://twitter.com/i/oauth2/authorize?"
        f"response_type=code&"
        f"client_id={TWITTER_CLIENT_ID}&"
        f"redirect_uri={TWITTER_REDIRECT_URI}&"
        f"scope=tweet.read%20tweet.write%20users.read%20offline.access&"
        f"state={state}&"
        f"code_challenge=challenge&"
        f"code_challenge_method=plain"
    )
    
    return jsonify({'auth_url': auth_url})


@auth_bp.route('/twitter/callback', methods=['POST'])
def twitter_callback():
    """Handle Twitter OAuth callback."""
    data = request.get_json()
    code = data.get('code')
    state = data.get('state')
    
    if not code or not state:
        return jsonify({'error': 'Code and state required'}), 400
    
    # Decode state to get user ID
    try:
        state_payload = jwt.decode(state, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = state_payload['user_id']
    except:
        return jsonify({'error': 'Invalid state'}), 400
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Exchange code for tokens
    token_response = requests.post(
        'https://api.twitter.com/2/oauth2/token',
        auth=(TWITTER_CLIENT_ID, TWITTER_CLIENT_SECRET),
        data={
            'code': code,
            'grant_type': 'authorization_code',
            'redirect_uri': TWITTER_REDIRECT_URI,
            'code_verifier': 'challenge'
        }
    )
    
    if token_response.status_code != 200:
        return jsonify({'error': 'Failed to exchange code'}), 400
    
    tokens = token_response.json()
    
    # Get user info from Twitter
    user_response = requests.get(
        'https://api.twitter.com/2/users/me',
        headers={'Authorization': f"Bearer {tokens['access_token']}"}
    )
    
    twitter_user = user_response.json().get('data', {})
    
    # Save or update token
    existing = SocialToken.query.filter_by(user_id=user.id, platform='twitter').first()
    
    if existing:
        existing.access_token = tokens['access_token']
        existing.refresh_token = tokens.get('refresh_token')
        existing.expires_at = datetime.utcnow() + timedelta(seconds=tokens.get('expires_in', 7200))
        existing.platform_user_id = twitter_user.get('id')
        existing.platform_username = twitter_user.get('username')
    else:
        social_token = SocialToken(
            user_id=user.id,
            platform='twitter',
            access_token=tokens['access_token'],
            refresh_token=tokens.get('refresh_token'),
            token_type=tokens.get('token_type'),
            expires_at=datetime.utcnow() + timedelta(seconds=tokens.get('expires_in', 7200)),
            platform_user_id=twitter_user.get('id'),
            platform_username=twitter_user.get('username')
        )
        db.session.add(social_token)
    
    db.session.commit()
    
    return jsonify({
        'message': 'Twitter connected successfully',
        'username': twitter_user.get('username')
    })


# ============ Social OAuth - LinkedIn ============

@auth_bp.route('/linkedin/connect', methods=['GET'])
@require_auth
def linkedin_connect(user):
    """Initiate LinkedIn OAuth flow."""
    if not LINKEDIN_CLIENT_ID:
        return jsonify({
            'error': 'LinkedIn OAuth not configured',
            'message': 'Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET'
        }), 400
    
    state = jwt.encode({'user_id': user.id}, JWT_SECRET, algorithm=JWT_ALGORITHM)
    
    auth_url = (
        f"https://www.linkedin.com/oauth/v2/authorization?"
        f"response_type=code&"
        f"client_id={LINKEDIN_CLIENT_ID}&"
        f"redirect_uri={LINKEDIN_REDIRECT_URI}&"
        f"scope=r_liteprofile%20w_member_social&"
        f"state={state}"
    )
    
    return jsonify({'auth_url': auth_url})


@auth_bp.route('/linkedin/callback', methods=['POST'])
def linkedin_callback():
    """Handle LinkedIn OAuth callback."""
    data = request.get_json()
    code = data.get('code')
    state = data.get('state')
    
    if not code or not state:
        return jsonify({'error': 'Code and state required'}), 400
    
    try:
        state_payload = jwt.decode(state, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = state_payload['user_id']
    except:
        return jsonify({'error': 'Invalid state'}), 400
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Exchange code for tokens
    token_response = requests.post(
        'https://www.linkedin.com/oauth/v2/accessToken',
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
        data={
            'grant_type': 'authorization_code',
            'code': code,
            'redirect_uri': LINKEDIN_REDIRECT_URI,
            'client_id': LINKEDIN_CLIENT_ID,
            'client_secret': LINKEDIN_CLIENT_SECRET
        }
    )
    
    if token_response.status_code != 200:
        return jsonify({'error': 'Failed to exchange code'}), 400
    
    tokens = token_response.json()
    
    # Get user profile
    profile_response = requests.get(
        'https://api.linkedin.com/v2/me',
        headers={'Authorization': f"Bearer {tokens['access_token']}"}
    )
    
    linkedin_user = profile_response.json()
    
    # Save or update token
    existing = SocialToken.query.filter_by(user_id=user.id, platform='linkedin').first()
    
    if existing:
        existing.access_token = tokens['access_token']
        existing.expires_at = datetime.utcnow() + timedelta(seconds=tokens.get('expires_in', 3600))
        existing.platform_user_id = linkedin_user.get('id')
    else:
        social_token = SocialToken(
            user_id=user.id,
            platform='linkedin',
            access_token=tokens['access_token'],
            token_type=tokens.get('token_type'),
            expires_at=datetime.utcnow() + timedelta(seconds=tokens.get('expires_in', 3600)),
            platform_user_id=linkedin_user.get('id')
        )
        db.session.add(social_token)
    
    db.session.commit()
    
    return jsonify({
        'message': 'LinkedIn connected successfully',
        'user_id': linkedin_user.get('id')
    })


# ============ Social OAuth - OneDrive ============

@auth_bp.route('/onedrive/connect', methods=['GET'])
@require_auth
def onedrive_connect(user):
    """Initiate OneDrive OAuth flow."""
    if not ONEDRIVE_CLIENT_ID:
        return jsonify({
            'error': 'OneDrive OAuth not configured',
            'message': 'Set ONEDRIVE_CLIENT_ID and ONEDRIVE_CLIENT_SECRET'
        }), 400
    
    state = jwt.encode({'user_id': user.id}, JWT_SECRET, algorithm=JWT_ALGORITHM)
    
    auth_url = (
        f"https://login.microsoftonline.com/common/oauth2/v2.0/authorize?"
        f"client_id={ONEDRIVE_CLIENT_ID}&"
        f"response_type=code&"
        f"redirect_uri={ONEDRIVE_REDIRECT_URI}&"
        f"response_mode=query&"
        f"scope=files.readwrite.all%20offline_access%20User.Read&"
        f"state={state}"
    )
    
    return jsonify({'auth_url': auth_url})


@auth_bp.route('/onedrive/callback', methods=['POST'])
def onedrive_callback():
    """Handle OneDrive OAuth callback."""
    data = request.get_json()
    code = data.get('code')
    state = data.get('state')
    
    if not code or not state:
        return jsonify({'error': 'Code and state required'}), 400
    
    try:
        state_payload = jwt.decode(state, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = state_payload['user_id']
    except:
        return jsonify({'error': 'Invalid state'}), 400
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Exchange code for tokens
    token_response = requests.post(
        'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        data={
            'client_id': ONEDRIVE_CLIENT_ID,
            'client_secret': ONEDRIVE_CLIENT_SECRET,
            'code': code,
            'redirect_uri': ONEDRIVE_REDIRECT_URI,
            'grant_type': 'authorization_code'
        }
    )
    
    if token_response.status_code != 200:
        return jsonify({'error': 'Failed to exchange code', 'details': token_response.text}), 400
    
    tokens = token_response.json()
    
    # Get user info
    user_response = requests.get(
        'https://graph.microsoft.com/v1.0/me',
        headers={'Authorization': f"Bearer {tokens['access_token']}"}
    )
    
    od_user = user_response.json()
    
    # Save or update token
    existing = SocialToken.query.filter_by(user_id=user.id, platform='onedrive').first()
    
    if existing:
        existing.access_token = tokens['access_token']
        existing.refresh_token = tokens.get('refresh_token')
        existing.expires_at = datetime.utcnow() + timedelta(seconds=tokens.get('expires_in', 3600))
        existing.platform_user_id = od_user.get('id')
        existing.platform_username = od_user.get('userPrincipalName')
    else:
        social_token = SocialToken(
            user_id=user.id,
            platform='onedrive',
            access_token=tokens['access_token'],
            refresh_token=tokens.get('refresh_token'),
            expires_at=datetime.utcnow() + timedelta(seconds=tokens.get('expires_in', 3600)),
            platform_user_id=od_user.get('id'),
            platform_username=od_user.get('userPrincipalName')
        )
        db.session.add(social_token)
    
    db.session.commit()
    
    return jsonify({
        'message': 'OneDrive connected successfully',
        'username': od_user.get('userPrincipalName')
    })


# ============ Social OAuth - Evernote ============

@auth_bp.route('/evernote/connect', methods=['GET'])
@require_auth
def evernote_connect(user):
    """Initiate Evernote OAuth flow (Note: Evernote uses OAuth 1.0 but can also support OAuth 2.0)."""
    # Using generic structure for Evernote OAuth 2.0 if available, but Evernote typically uses 1.0a.
    # For simplicity and consistency with the rest of the app, we'll implement a skeleton that can be filled.
    if not EVERNOTE_CONSUMER_KEY:
        return jsonify({
            'error': 'Evernote OAuth not configured',
            'message': 'Set EVERNOTE_CONSUMER_KEY and EVERNOTE_CONSUMER_SECRET'
        }), 400
    
    state = jwt.encode({'user_id': user.id}, JWT_SECRET, algorithm=JWT_ALGORITHM)
    
    # Example Evernote OAuth 2.0 (if using their new API, otherwise 1.0a is quite different)
    auth_url = (
        f"https://www.evernote.com/oauth20/authorize?"
        f"client_id={EVERNOTE_CONSUMER_KEY}&"
        f"response_type=code&"
        f"redirect_uri={EVERNOTE_REDIRECT_URI}&"
        f"state={state}"
    )
    
    return jsonify({'auth_url': auth_url})


@auth_bp.route('/evernote/callback', methods=['POST'])
def evernote_callback():
    """Handle Evernote OAuth callback."""
    data = request.get_json()
    code = data.get('code')
    state = data.get('state')
    
    if not code or not state:
        return jsonify({'error': 'Code and state required'}), 400
    
    try:
        state_payload = jwt.decode(state, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = state_payload['user_id']
    except:
        return jsonify({'error': 'Invalid state'}), 400
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Exchange code for tokens
    token_response = requests.post(
        'https://www.evernote.com/oauth20/token',
        data={
            'grant_type': 'authorization_code',
            'client_id': EVERNOTE_CONSUMER_KEY,
            'client_secret': EVERNOTE_CONSUMER_SECRET,
            'redirect_uri': EVERNOTE_REDIRECT_URI,
            'code': code
        }
    )
    
    if token_response.status_code != 200:
        return jsonify({'error': 'Failed to exchange code', 'details': token_response.text}), 400
    
    tokens = token_response.json()
    
    # Save or update token
    existing = SocialToken.query.filter_by(user_id=user.id, platform='evernote').first()
    
    if existing:
        existing.access_token = tokens['access_token']
        # Evernote tokens often have very long lifetimes or are permanent in sandbox
        existing.expires_at = datetime.utcnow() + timedelta(days=365) 
    else:
        social_token = SocialToken(
            user_id=user.id,
            platform='evernote',
            access_token=tokens['access_token'],
            expires_at=datetime.utcnow() + timedelta(days=365)
        )
        db.session.add(social_token)
    
    db.session.commit()
    
    return jsonify({
        'message': 'Evernote connected successfully'
    })


# ============ Connection Management ============

@auth_bp.route('/connections', methods=['GET'])
@require_auth
def get_connections(user):
    """Get user's connected social accounts."""
    connections = []
    for token in user.social_tokens:
        connections.append(token.to_dict())
    
    return jsonify({'connections': connections})


@auth_bp.route('/connections/<platform>', methods=['DELETE'])
@require_auth
def disconnect_platform(user, platform):
    """Disconnect a social platform."""
    token = SocialToken.query.filter_by(user_id=user.id, platform=platform).first()
    
    if not token:
        return jsonify({'error': 'Connection not found'}), 404
    
    db.session.delete(token)
    db.session.commit()
    
    return jsonify({'message': f'{platform.capitalize()} disconnected'})

