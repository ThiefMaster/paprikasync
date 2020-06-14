from pathlib import Path

import appdirs

DATA_DIR = Path(appdirs.user_config_dir('paprikasync'))
CONFIG_FILE: Path = DATA_DIR / 'config.json'
