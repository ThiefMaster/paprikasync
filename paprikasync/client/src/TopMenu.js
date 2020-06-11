import React from 'react';
import {Container, Dropdown, Image, Menu, Popup} from 'semantic-ui-react';
import pepper from './pepper.svg';
import {useAuth} from './util/auth';

export const TopMenu = () => {
  const {name, logout} = useAuth(true);

  const userOptions = [{key: name, value: name, text: name}];
  const selectedUser = name;

  return (
    <Menu fixed="top" inverted>
      <Container>
        <Menu.Item header>
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
            trigger={<Menu.Item as="a" icon="log out" onClick={logout} />}
            content="Log out"
          />
        </Menu.Menu>
      </Container>
    </Menu>
  );
};
