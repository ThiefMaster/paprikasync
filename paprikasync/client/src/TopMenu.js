import _ from 'lodash';
import React, {useState, useEffect} from 'react';
import {Link} from 'react-router-dom';
import {Container, Dropdown, Icon, Image, Menu, Popup} from 'semantic-ui-react';
import pepper from './pepper.svg';
import {useAuth} from './util/auth';
import {useStore} from './util/store';

export const TopMenu = () => {
  const {
    user: {name},
    logout,
  } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const {
    refreshPaprika,
    loadActivePartners,
    selectPartner,
    partners,
    selectedPartner,
    selectedPartnerName,
  } = useStore();

  useEffect(() => {
    loadActivePartners();
  }, [loadActivePartners]);

  const userOptions = [
    {
      key: 'self',
      value: null,
      text: (
        <>
          {name} <em>(that's you)</em>
        </>
      ),
    },
    ..._.sortBy(partners, 'name').map(p => ({key: p.id, value: p.id, text: p.name})),
  ];
  const selectedName = selectedPartner ? selectedPartnerName : name;

  const sync = async () => {
    setSyncing(true);
    await refreshPaprika();
    setSyncing(false);
  };

  return (
    <Menu fixed="top" inverted>
      <Container>
        <Menu.Item as={Link} to="/" header>
          <Image size="mini" src={pepper} style={{marginRight: '1.5em'}} />
          Paprikasync
        </Menu.Item>
        <Dropdown
          item
          simple
          options={userOptions}
          value={selectedPartner}
          selectOnBlur={false}
          selectOnNavigation={false}
          text={selectedName}
          onChange={(evt, {value}) => selectPartner(value)}
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
            trigger={<Menu.Item as={Link} to="/user" icon="user" />}
            content="User settings"
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
