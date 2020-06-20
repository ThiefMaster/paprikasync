import PropTypes from 'prop-types';
import React, {useState} from 'react';
import {Popup} from 'semantic-ui-react';
import {useTimeout} from './util/timeout';

export const ClipboardText = ({text, successText, children}) => {
  const [copied, setCopied] = useState(false);
  useTimeout(() => setCopied(false), copied ? 2000 : null);

  const handleOpen = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
  };

  const handleClose = () => {
    setCopied(false);
  };

  return (
    <Popup
      on="click"
      position="top center"
      trigger={
        <span style={copied ? {} : {cursor: 'pointer'}} disabled={copied}>
          {children || text}
        </span>
      }
      onOpen={handleOpen}
      open={copied}
      onClose={handleClose}
      content={successText || 'Text copied'}
    />
  );
};

ClipboardText.propTypes = {
  text: PropTypes.string.isRequired,
  children: PropTypes.node,
  successText: PropTypes.string,
};

ClipboardText.defaultProps = {
  children: null,
  successText: null,
};
