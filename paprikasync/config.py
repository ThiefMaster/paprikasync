from dataclasses import dataclass, field
from typing import List, Optional

from dataclasses_json import dataclass_json

from .constants import CONFIG_FILE, DATA_DIR


@dataclass
class Partner:
    name: str
    token: str


@dataclass_json()
@dataclass
class Config:
    user_token: Optional[str] = None
    partners: List[Partner] = field(default_factory=list)

    def add_partner(self, name, token) -> None:
        self.partners.append(Partner(name, token))

    def save(self) -> None:
        DATA_DIR.mkdir(0o700, parents=True, exist_ok=True)
        CONFIG_FILE.write_text(self.to_json(indent=2) + '\n')


def load_config() -> Config:
    try:
        return Config.from_json(CONFIG_FILE.read_text())
    except FileNotFoundError:
        return Config()
