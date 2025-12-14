"""
安全中间件
阻止访问敏感文件和路径
"""
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from core.logger import logger
import re


class SecurityMiddleware(BaseHTTPMiddleware):
    """安全中间件，阻止访问敏感文件"""
    
    # 敏感路径模式（正则表达式）
    SENSITIVE_PATTERNS = [
        r'^/\.env',                    # .env 文件
        r'^/\.env\.',                  # .env.* 文件
        r'^/\.git/',                   # .git 目录
        r'^/\.git/config',             # .git/config
        r'^/\.git/HEAD',               # .git/HEAD
        r'^/\.gitignore',              # .gitignore
        r'^/\.gitattributes',          # .gitattributes
        r'^/\.htaccess',               # .htaccess
        r'^/\.htpasswd',               # .htpasswd
        r'^/\.ssh/',                   # .ssh 目录
        r'^/\.aws/',                   # .aws 目录
        r'^/\.docker/',                # .docker 目录
        r'^/\.vscode/',                # .vscode 目录
        r'^/\.idea/',                  # .idea 目录
        r'^/\.DS_Store',               # .DS_Store
        r'^/\.env\.local',             # .env.local
        r'^/\.env\.production',        # .env.production
        r'^/\.env\.development',       # .env.development
        r'^/config\.json',             # config.json
        r'^/secrets\.json',            # secrets.json
        r'^/\.npmrc',                  # .npmrc
        r'^/\.yarnrc',                 # .yarnrc
        r'^/package-lock\.json',       # package-lock.json（可能包含敏感信息）
        r'^/yarn\.lock',               # yarn.lock
        r'^/composer\.json',           # composer.json
        r'^/\.composer/',              # .composer 目录
        r'^/\.pypirc',                 # .pypirc
        r'^/\.pip/',                   # .pip 目录
        r'^/\.python_history',         # .python_history
        r'^/\.bash_history',           # .bash_history
        r'^/\.zsh_history',            # .zsh_history
        r'^/\.mysql_history',          # .mysql_history
        r'^/\.psql_history',           # .psql_history
        r'^/\.rediscli_history',       # .rediscli_history
        r'^/\.sqlite',                 # .sqlite 文件
        r'^/\.db$',                    # .db 文件
        r'^/\.sql$',                   # .sql 文件
        r'^/\.log$',                   # .log 文件
        r'^/\.bak$',                   # .bak 文件
        r'^/\.backup$',                # .backup 文件
        r'^/\.swp$',                   # .swp 文件
        r'^/\.swo$',                   # .swo 文件
        r'^/\.tmp$',                   # .tmp 文件
        r'^/\.temp$',                  # .temp 文件
        r'^/\.cache/',                 # .cache 目录
        r'^/\.local/',                 # .local 目录
        r'^/\.config/',                # .config 目录
        r'^/\.credentials/',           # .credentials 目录
        r'^/\.secrets/',               # .secrets 目录
        r'^/\.private/',               # .private 目录
        r'^/\.internal/',               # .internal 目录
        r'^/\.admin/',                  # .admin 目录
        r'^/\.test/',                  # .test 目录
        r'^/\.debug/',                 # .debug 目录
        r'^/\.dev/',                   # .dev 目录
        r'^/\.staging/',               # .staging 目录
        r'^/\.production/',            # .production 目录
        r'^/\.development/',           # .development 目录
        r'^/\.env\.test',              # .env.test
        r'^/\.env\.staging',           # .env.staging
        r'^/\.env\.prod',              # .env.prod
        r'^/\.env\.dev',               # .env.dev
        r'^/\.env\.local',             # .env.local
        r'^/\.env\.example',           # .env.example
        r'^/\.env\.sample',            # .env.sample
        r'^/\.env\.template',          # .env.template
        r'^/\.env\.backup',            # .env.backup
        r'^/\.env\.old',               # .env.old
        r'^/\.env\.new',               # .env.new
        r'^/\.env\.orig',              # .env.orig
        r'^/\.env\.save',              # .env.save
        r'^/\.env\.tmp',               # .env.tmp
        r'^/\.env\.temp',              # .env.temp
        r'^/\.env\.swp',               # .env.swp
        r'^/\.env\.swo',               # .env.swo
        r'^/\.env\.bak',               # .env.bak
        r'^/\.env\.log',               # .env.log
        r'^/\.env\.txt',               # .env.txt
        r'^/\.env\.json',              # .env.json
        r'^/\.env\.xml',               # .env.xml
        r'^/\.env\.yaml',              # .env.yaml
        r'^/\.env\.yml',               # .env.yml
        r'^/\.env\.ini',               # .env.ini
        r'^/\.env\.conf',              # .env.conf
        r'^/\.env\.cfg',               # .env.cfg
        r'^/\.env\.properties',        # .env.properties
        r'^/\.env\.config',           # .env.config
        r'^/\.env\.settings',         # .env.settings
        r'^/\.env\.secrets',          # .env.secrets
        r'^/\.env\.private',          # .env.private
        r'^/\.env\.secure',           # .env.secure
        r'^/\.env\.hidden',           # .env.hidden
        r'^/\.env\.secret',           # .env.secret
        r'^/\.env\.key',              # .env.key
        r'^/\.env\.token',            # .env.token
        r'^/\.env\.password',         # .env.password
        r'^/\.env\.credential',       # .env.credential
        r'^/\.env\.auth',             # .env.auth
        r'^/\.env\.api',              # .env.api
        r'^/\.env\.db',               # .env.db
        r'^/\.env\.database',         # .env.database
        r'^/\.env\.mysql',            # .env.mysql
        r'^/\.env\.postgres',         # .env.postgres
        r'^/\.env\.redis',            # .env.redis
        r'^/\.env\.mongo',            # .env.mongo
        r'^/\.env\.elastic',          # .env.elastic
        r'^/\.env\.aws',              # .env.aws
        r'^/\.env\.azure',            # .env.azure
        r'^/\.env\.gcp',              # .env.gcp
        r'^/\.env\.aliyun',           # .env.aliyun
        r'^/\.env\.tencent',          # .env.tencent
        r'^/\.env\.baidu',            # .env.baidu
        r'^/\.env\.huawei',           # .env.huawei
        r'^/\.env\.jd',               # .env.jd
        r'^/\.env\.netease',          # .env.netease
        r'^/\.env\.sina',             # .env.sina
        r'^/\.env\.sohu',             # .env.sohu
        r'^/\.env\.163',              # .env.163
        r'^/\.env\.126',              # .env.126
        r'^/\.env\.qq',               # .env.qq
        r'^/\.env\.wechat',           # .env.wechat
        r'^/\.env\.weibo',            # .env.weibo
        r'^/\.env\.douyin',           # .env.douyin
        r'^/\.env\.kuaishou',         # .env.kuaishou
        r'^/\.env\.bilibili',         # .env.bilibili
        r'^/\.env\.zhihu',            # .env.zhihu
        r'^/\.env\.github',           # .env.github
        r'^/\.env\.gitlab',           # .env.gitlab
        r'^/\.env\.bitbucket',        # .env.bitbucket
        r'^/\.env\.jira',             # .env.jira
        r'^/\.env\.confluence',       # .env.confluence
        r'^/\.env\.slack',            # .env.slack
        r'^/\.env\.discord',          # .env.discord
        r'^/\.env\.telegram',         # .env.telegram
        r'^/\.env\.whatsapp',         # .env.whatsapp
        r'^/\.env\.line',             # .env.line
        r'^/\.env\.viber',            # .env.viber
        r'^/\.env\.signal',           # .env.signal
        r'^/\.env\.wechatwork',       # .env.wechatwork
        r'^/\.env\.dingtalk',         # .env.dingtalk
        r'^/\.env\.feishu',           # .env.feishu
        r'^/\.env\.lark',             # .env.lark
        r'^/\.env\.notion',           # .env.notion
        r'^/\.env\.evernote',         # .env.evernote
        r'^/\.env\.onenote',          # .env.onenote
        r'^/\.env\.dropbox',          # .env.dropbox
        r'^/\.env\.googledrive',      # .env.googledrive
        r'^/\.env\.onedrive',         # .env.onedrive
        r'^/\.env\.icloud',           # .env.icloud
        r'^/\.env\.box',              # .env.box
        r'^/\.env\.mega',             # .env.mega
        r'^/\.env\.pcloud',           # .env.pcloud
        r'^/\.env\.sync',             # .env.sync
        r'^/\.env\.backup',           # .env.backup
        r'^/\.env\.archive',          # .env.archive
        r'^/\.env\.old',              # .env.old
        r'^/\.env\.new',              # .env.new
        r'^/\.env\.orig',             # .env.orig
        r'^/\.env\.save',             # .env.save
        r'^/\.env\.tmp',              # .env.tmp
        r'^/\.env\.temp',             # .env.temp
        r'^/\.env\.swp',              # .env.swp
        r'^/\.env\.swo',              # .env.swo
        r'^/\.env\.bak',              # .env.bak
        r'^/\.env\.log',              # .env.log
        r'^/\.env\.txt',              # .env.txt
        r'^/\.env\.json',             # .env.json
        r'^/\.env\.xml',              # .env.xml
        r'^/\.env\.yaml',             # .env.yaml
        r'^/\.env\.yml',              # .env.yml
        r'^/\.env\.ini',              # .env.ini
        r'^/\.env\.conf',             # .env.conf
        r'^/\.env\.cfg',              # .env.cfg
        r'^/\.env\.properties',       # .env.properties
        r'^/\.env\.config',           # .env.config
        r'^/\.env\.settings',         # .env.settings
        r'^/\.env\.secrets',          # .env.secrets
        r'^/\.env\.private',          # .env.private
        r'^/\.env\.secure',           # .env.secure
        r'^/\.env\.hidden',           # .env.hidden
        r'^/\.env\.secret',           # .env.secret
        r'^/\.env\.key',              # .env.key
        r'^/\.env\.token',            # .env.token
        r'^/\.env\.password',         # .env.password
        r'^/\.env\.credential',       # .env.credential
        r'^/\.env\.auth',             # .env.auth
        r'^/\.env\.api',              # .env.api
        r'^/\.env\.db',               # .env.db
        r'^/\.env\.database',         # .env.database
        r'^/\.env\.mysql',            # .env.mysql
        r'^/\.env\.postgres',         # .env.postgres
        r'^/\.env\.redis',            # .env.redis
        r'^/\.env\.mongo',            # .env.mongo
        r'^/\.env\.elastic',         # .env.elastic
        r'^/\.env\.aws',              # .env.aws
        r'^/\.env\.azure',            # .env.azure
        r'^/\.env\.gcp',              # .env.gcp
        r'^/\.env\.aliyun',           # .env.aliyun
        r'^/\.env\.tencent',          # .env.tencent
        r'^/\.env\.baidu',            # .env.baidu
        r'^/\.env\.huawei',           # .env.huawei
        r'^/\.env\.jd',               # .env.jd
        r'^/\.env\.netease',          # .env.netease
        r'^/\.env\.sina',             # .env.sina
        r'^/\.env\.sohu',             # .env.sohu
        r'^/\.env\.163',              # .env.163
        r'^/\.env\.126',              # .env.126
        r'^/\.env\.qq',               # .env.qq
        r'^/\.env\.wechat',           # .env.wechat
        r'^/\.env\.weibo',            # .env.weibo
        r'^/\.env\.douyin',           # .env.douyin
        r'^/\.env\.kuaishou',         # .env.kuaishou
        r'^/\.env\.bilibili',         # .env.bilibili
        r'^/\.env\.zhihu',            # .env.zhihu
        r'^/\.env\.github',           # .env.github
        r'^/\.env\.gitlab',           # .env.gitlab
        r'^/\.env\.bitbucket',        # .env.bitbucket
        r'^/\.env\.jira',             # .env.jira
        r'^/\.env\.confluence',       # .env.confluence
        r'^/\.env\.slack',            # .env.slack
        r'^/\.env\.discord',          # .env.discord
        r'^/\.env\.telegram',         # .env.telegram
        r'^/\.env\.whatsapp',         # .env.whatsapp
        r'^/\.env\.line',             # .env.line
        r'^/\.env\.viber',            # .env.viber
        r'^/\.env\.signal',           # .env.signal
        r'^/\.env\.wechatwork',       # .env.wechatwork
        r'^/\.env\.dingtalk',         # .env.dingtalk
        r'^/\.env\.feishu',           # .env.feishu
        r'^/\.env\.lark',             # .env.lark
        r'^/\.env\.notion',           # .env.notion
        r'^/\.env\.evernote',         # .env.evernote
        r'^/\.env\.onenote',          # .env.onenote
        r'^/\.env\.dropbox',          # .env.dropbox
        r'^/\.env\.googledrive',      # .env.googledrive
        r'^/\.env\.onedrive',         # .env.onedrive
        r'^/\.env\.icloud',           # .env.icloud
        r'^/\.env\.box',              # .env.box
        r'^/\.env\.mega',             # .env.mega
        r'^/\.env\.pcloud',           # .env.pcloud
        r'^/\.env\.sync',             # .env.sync
        r'^/\.env\.backup',           # .env.backup
        r'^/\.env\.archive',          # .env.archive
    ]
    
    # 编译正则表达式
    _compiled_patterns = [re.compile(pattern, re.IGNORECASE) for pattern in SENSITIVE_PATTERNS]
    
    async def dispatch(self, request: Request, call_next):
        """处理请求"""
        path = request.url.path
        client_ip = request.client.host if request.client else 'unknown'
        
        # 检查是否为敏感路径
        for pattern in self._compiled_patterns:
            if pattern.match(path):
                # 记录安全警告
                logger.warning(
                    f"[SECURITY] Blocked access attempt to sensitive path: {path} "
                    f"from IP: {client_ip} "
                    f"User-Agent: {request.headers.get('user-agent', 'unknown')}"
                )
                
                # 返回 404 而不是 403，避免暴露敏感信息
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content={"detail": "Not Found"}
                )
        
        # 继续处理正常请求
        try:
            response = await call_next(request)
            return response
        except Exception as e:
            logger.error(f"Security middleware error: {e}", exc_info=True)
            raise

