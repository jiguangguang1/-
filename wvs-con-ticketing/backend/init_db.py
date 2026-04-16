"""数据库初始化脚本"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from models import db, User

app = create_app()

with app.app_context():
    db.create_all()

    # 创建管理员账号
    admin = User.query.filter_by(username='admin').first()
    if not admin:
        admin = User(username='admin', email='admin@wvs.local', is_admin=True)
        admin.set_password('admin123')
        db.session.add(admin)
        print("✅ 创建管理员账号: admin / admin123")
    else:
        print("ℹ️ 管理员已存在")

    db.session.commit()
    print("✅ 数据库初始化完成")
