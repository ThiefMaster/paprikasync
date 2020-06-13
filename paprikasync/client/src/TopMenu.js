import flask from 'flask-urls.macro';
import React, {useState} from 'react';
import {Link} from 'react-router-dom';
import {Container, Dropdown, Icon, Image, Menu, Popup} from 'semantic-ui-react';
import pepper from './pepper.svg';
import {useAuth} from './util/auth';
import {fetchJSON} from './util/fetch';

export const TopMenu = () => {
  const {name, logout} = useAuth(true);
  const [syncing, setSyncing] = useState(false);

  const userOptions = [{key: name, value: name, text: name}];
  const selectedUser = name;

  const sync = async () => {
    setSyncing(true);
    console.log('Starting sync');
    const [code, resp] = await fetchJSON(flask`api.user_refresh_paprika`(), {});
    if (code !== 200) {
      console.log('Sync failed');
    } else {
      console.log('Sync finished', resp);
    }
    setSyncing(false);
  };

  return (
    <Menu fixed="top" inverted>
      <Container>
        <Menu.Item as={Link} to="/" header>
          <Image
            size="mini"
            src={pepper}
            style={{
              marginRight: '1.5em',
              filter:
                // black magic converting black to orange... until there's a properly-colored image
                'invert(100%) sepia(100%) saturate(10000%) hue-rotate(300deg) saturate(1000%)',
            }}
          />
          Paprikasync
        </Menu.Item>
        <Dropdown
          item
          simple
          options={userOptions}
          value={selectedUser}
          selectOnBlur={false}
          selectOnNavigation={false}
          text={name.split('@')[0]}
        />
        <Menu.Menu position="right">
          <Popup
            inverted
            content={syncing ? 'Synchronizing...' : 'Synchronize with Paprika'}
            trigger={
              <Menu.Item
                icon
                onClick={() => !syncing && sync()}
                style={syncing ? {} : {cursor: 'pointer'}}
              >
                <Icon name="sync alternate" disabled={syncing} loading={syncing} />
              </Menu.Item>
            }
          />
          <Popup
            inverted
            trigger={<Menu.Item as="a" icon="log out" onClick={logout} />}
            content="Log out"
          />
        </Menu.Menu>
      </Container>
    </Menu>
  );
};
