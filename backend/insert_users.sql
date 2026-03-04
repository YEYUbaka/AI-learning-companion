(trapped) error reading bcrypt version
Traceback (most recent call last):
  File "E:\AI_projects\Web\backend\venv\lib\site-packages\passlib\handlers\bcrypt.py", line 620, in _load_backend_mixin
    version = _bcrypt.__about__.__version__
AttributeError: module 'bcrypt' has no attribute '__about__'
Traceback (most recent call last):
  File "<string>", line 14, in <module>
  File "E:\AI_projects\Web\backend\venv\lib\site-packages\passlib\context.py", line 2258, in hash
    return record.hash(secret, **kwds)
  File "E:\AI_projects\Web\backend\venv\lib\site-packages\passlib\utils\handlers.py", line 779, in hash
    self.checksum = self._calc_checksum(secret)
  File "E:\AI_projects\Web\backend\venv\lib\site-packages\passlib\handlers\bcrypt.py", line 591, in _calc_checksum
    self._stub_requires_backend()
  File "E:\AI_projects\Web\backend\venv\lib\site-packages\passlib\utils\handlers.py", line 2254, in _stub_requires_backend
    cls.set_backend()
  File "E:\AI_projects\Web\backend\venv\lib\site-packages\passlib\utils\handlers.py", line 2156, in set_backend
    return owner.set_backend(name, dryrun=dryrun)
  File "E:\AI_projects\Web\backend\venv\lib\site-packages\passlib\utils\handlers.py", line 2163, in set_backend
    return cls.set_backend(name, dryrun=dryrun)
  File "E:\AI_projects\Web\backend\venv\lib\site-packages\passlib\utils\handlers.py", line 2188, in set_backend
    cls._set_backend(name, dryrun)
  File "E:\AI_projects\Web\backend\venv\lib\site-packages\passlib\utils\handlers.py", line 2311, in _set_backend
    super(SubclassBackendMixin, cls)._set_backend(name, dryrun)
  File "E:\AI_projects\Web\backend\venv\lib\site-packages\passlib\utils\handlers.py", line 2224, in _set_backend
    ok = loader(**kwds)
  File "E:\AI_projects\Web\backend\venv\lib\site-packages\passlib\handlers\bcrypt.py", line 626, in _load_backend_mixin
    return mixin_cls._finalize_backend_mixin(name, dryrun)
  File "E:\AI_projects\Web\backend\venv\lib\site-packages\passlib\handlers\bcrypt.py", line 421, in _finalize_backend_mixin
    if detect_wrap_bug(IDENT_2A):
  File "E:\AI_projects\Web\backend\venv\lib\site-packages\passlib\handlers\bcrypt.py", line 380, in detect_wrap_bug
    if verify(secret, bug_hash):
  File "E:\AI_projects\Web\backend\venv\lib\site-packages\passlib\utils\handlers.py", line 792, in verify
    return consteq(self._calc_checksum(secret), chk)
  File "E:\AI_projects\Web\backend\venv\lib\site-packages\passlib\handlers\bcrypt.py", line 655, in _calc_checksum
    hash = _bcrypt.hashpw(secret, config)
ValueError: password cannot be longer than 72 bytes, truncate manually if necessary (e.g. my_password[:72])
