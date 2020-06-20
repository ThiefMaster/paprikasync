import React from 'react';
import {MyPartners} from './MyPartners';
import {MyProfile} from './MyProfile';

export const UserSettings = () => {
  return (
    <div style={{maxWidth: 768}}>
      <MyProfile />
      <MyPartners />
    </div>
  );
};
