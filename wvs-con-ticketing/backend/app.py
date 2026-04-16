"""Flask 主应用"""

import os
import sys

# 确保能导入同目录模块
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, get_jwt_identity

from config import config_map
from models import db, User, Order, OrderLog
from auth import login_required, admin_required
from routes.orders import orders_bp
from routes.admin import admin_bp

def create_app(config_name=None):
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'default')

    app = Flask(__name__, static_folder='../frontend', static_url_path='')
    app.config.from_object(config_map[config_name])

    # 确保目录存在
    os.makedirs(app.config.get('LOG_DIR', 'logs'), exist_ok=True)
    os.makedirs(app.config.get('SCREENSHOT_DIR', 'screenshots'), exist_ok=True)

    # 初始化扩展
    CORS(app)
    db.init_app(app)
    JWTManager(app)

    # 注册蓝图
    app.register_blueprint(orders_bp)
    app.register_blueprint(admin_bp)

    # ---- 认证 API ----

    @app.route('/api/auth/register', methods=['POST'])
    def register():
        data = request.get_json()
        if not data:
            return jsonify({'error': '请求体为空'}), 400

        username = data.get('username', '').strip()
        email = data.get('email', '').strip()
        password = data.get('password', '')

        if not username or not email or not password:
            return jsonify({'error': '请填写完整信息'}), 400
        if len(password) < 6:
            return jsonify({'error': '密码至少6位'}), 400

        if User.query.filter_by(username=username).first():
            return jsonify({'error': '用户名已存在'}), 409
        if User.query.filter_by(email=email).first():
            return jsonify({'error': '邮箱已注册'}), 409

        user = User(username=username, email=email)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()

        token = create_access_token(identity=user.id)
        return jsonify({
            'message': '注册成功',
            'token': token,
            'user': user.to_dict(),
        }), 201

    @app.route('/api/auth/login', methods=['POST'])
    def login():
        data = request.get_json()
        if not data:
            return jsonify({'error': '请求体为空'}), 400

        username = data.get('username', '').strip()
        password = data.get('password', '')

        user = User.query.filter(
            (User.username == username) | (User.email == username)
        ).first()

        if not user or not user.check_password(password):
            return jsonify({'error': '用户名或密码错误'}), 401

        token = create_access_token(identity=user.id)
        return jsonify({
            'message': '登录成功',
            'token': token,
            'user': user.to_dict(),
        })

    @app.route('/api/auth/me', methods=['GET'])
    @login_required
    def get_me():
        user_id = get_jwt_identity()
        user = db.get(User, user_id)
        if not user:
            return jsonify({'error': '用户不存在'}), 404
        return jsonify(user.to_dict())

    @app.route('/api/auth/profile', methods=['PUT'])
    @login_required
    def update_profile():
        user_id = get_jwt_identity()
        user = db.get(User, user_id)
        if not user:
            return jsonify({'error': '用户不存在'}), 404

        data = request.get_json()
        if 'interpark_id' in data:
            user.interpark_id = data['interpark_id']
        if 'interpark_pw' in data:
            user.interpark_pw_encrypted = data['interpark_pw']
        if 'weverse_id' in data:
            user.weverse_id = data['weverse_id']
        if 'has_presale' in data:
            user.has_presale = bool(data['has_presale'])

        db.session.commit()
        return jsonify({'message': '更新成功', 'user': user.to_dict()})

    # ---- 静态文件 ----

    @app.route('/')
    def index():
        return app.send_static_file('index.html')

    @app.route('/dashboard')
    def dashboard_page():
        return app.send_static_file('dashboard.html')

    @app.route('/admin')
    def admin_page():
        return app.send_static_file('admin.html')

    # ---- 健康检查 ----

    @app.route('/api/health')
    def health():
        return jsonify({'status': 'ok', 'service': 'wvs-con-ticketing'})

    # ---- 创建数据库 ----

    with app.app_context():
        db.create_all()

        # 创建默认管理员
        admin = User.query.filter_by(username='admin').first()
        if not admin:
            admin = User(username='admin', email='admin@wvs.local', is_admin=True)
            admin.set_password('admin123')
            db.session.add(admin)
            db.session.commit()

    return app


if __name__ == '__main__':
    app = create_app()
    print("🎫 Weverse Con 2026 抢票系统启动")
    print("📡 http://localhost:5000")
    print("👤 管理员: admin / admin123")
    app.run(host='0.0.0.0', port=5000, debug=True)
