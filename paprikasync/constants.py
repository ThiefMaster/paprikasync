import appdirs
from pathlib import Path

DATA_DIR = Path(appdirs.user_config_dir('paprikasync'))
CONFIG_FILE: Path = DATA_DIR / 'config.json'
