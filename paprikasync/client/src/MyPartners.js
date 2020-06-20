import React, {useEffect, useState} from 'react';
import {Field, Form as FinalForm} from 'react-final-form';
import {Button, Confirm, Form, Header, List, Message, Modal, Popup} from 'semantic-ui-react';
import {ClipboardText} from './ClipboardText';
import {useAuth} from './util/auth';
import {SILENT_INVALID, SUIInputAdapter} from './util/forms';
import {useStore} from './util/store';

const PartnerItem = ({partner}) => {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const {deleteActivePartner} = useStore();

  const removePartner = () => {
    setConfirmingDelete(false);
    deleteActivePartner(partner.id);
  };

  return (
    <List.Item>
      <List.Content floated="right">
        <Popup
          trigger={
            <Button
              icon="x"
              basic
              color="orange"
              size="tiny"
              onClick={() => setConfirmingDelete(true)}
            />
          }
        >
          Remove <strong>{partner.name}</strong> from your partners.
        </Popup>
        <Confirm
          open={confirmingDelete}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={removePartner}
          size="tiny"
          content={
            <Modal.Content>
              Do you really want to remove <strong>{partner.name}</strong> from your partners? You
              will no longer be able to see each other's recipes.
            </Modal.Content>
          }
        />
      </List.Content>
      <List.Icon name="user" size="large" verticalAlign="middle" />
      <List.Content verticalAlign="middle">
        <List.Header>{partner.name}</List.Header>
        <List.Description>
          {partner.recipe_count} recipe{partner.recipe_count !== 1 ? 's' : ''}
        </List.Description>
      </List.Content>
    </List.Item>
  );
};

const IncomingPendingPartnerItem = ({partner}) => {
  const {approvePendingPartner, deletePendingPartner} = useStore();
  return (
    <List.Item>
      <List.Content floated="right">
        <Popup
          trigger={
            <Button
              icon="check"
              basic
              color="green"
              size="tiny"
              onClick={() => approvePendingPartner(partner.id)}
            />
          }
        >
          Accept the partner request from <strong>{partner.name}</strong>.
        </Popup>
        <Popup
          trigger={
            <Button
              icon="x"
              basic
              color="red"
              size="tiny"
              onClick={() => deletePendingPartner(partner.id)}
            />
          }
        >
          Reject the partner request from <strong>{partner.name}</strong>.
        </Popup>
      </List.Content>
      <List.Icon name="user" color="blue" size="large" verticalAlign="middle" />
      <List.Content verticalAlign="middle">
        <List.Header>{partner.name}</List.Header>
        <List.Description>Awaiting your approval</List.Description>
      </List.Content>
    </List.Item>
  );
};

const OutgoingPendingPartnerItem = ({partner}) => {
  const {deletePendingPartner} = useStore();

  return (
    <List.Item>
      <List.Content floated="right">
        <Popup
          trigger={
            <Button
              icon="x"
              basic
              color="orange"
              size="tiny"
              onClick={() => deletePendingPartner(partner.id)}
            />
          }
        >
          Cancel the partner request for <strong>{partner.name}</strong>.
        </Popup>
      </List.Content>
      <List.Icon name="user" color="green" size="large" verticalAlign="middle" />
      <List.Content verticalAlign="middle">
        <List.Header>{partner.name}</List.Header>
        <List.Description>Awaiting approval by your partner</List.Description>
      </List.Content>
    </List.Item>
  );
};

const AddPartner = () => {
  const {requestPartnership} = useStore();
  const {
    user: {partner_code: partnerCode},
  } = useAuth();

  const handleSubmit = async ({code}, api) => {
    const error = await requestPartnership(code);
    if (!error) {
      setTimeout(() => api.reset(), 0);
      return;
    }
    const errorMsg =
      {
        no_such_user: 'Invalid partner code',
        cannot_add_self: "That's you...",
      }[error] || error;
    return {code: errorMsg};
  };

  return (
    <FinalForm
      onSubmit={handleSubmit}
      subscription={{
        submitting: true,
        pristine: true,
        hasValidationErrors: true,
      }}
    >
      {({handleSubmit, submitting, pristine, hasValidationErrors}) => (
        <Form onSubmit={handleSubmit}>
          <Header as="h2">Add new partner</Header>
          <Field
            verboseError
            width={8}
            name="code"
            component={SUIInputAdapter}
            placeholder="Enter partner code to add someone"
            validate={v => {
              let val;
              if (!v || !(val = v.trim())) {
                // invalid but no visible error message
                return SILENT_INVALID;
              }
              if (!/^[^#]+#\d+$/.test(val)) {
                return 'Invalid partner code';
              } else if (val === partnerCode) {
                return "That's you...";
              }
            }}
            action={{
              primary: true,
              disabled: submitting || pristine || hasValidationErrors,
              icon: 'save',
            }}
          />
        </Form>
      )}
    </FinalForm>
  );
};

export const MyPartners = () => {
  const {
    user: {partner_code: partnerCode},
  } = useAuth();

  const {partners, pendingPartners, loadActivePartners, loadPendingPartners} = useStore();

  useEffect(() => {
    loadActivePartners();
    loadPendingPartners();
  }, [loadActivePartners, loadPendingPartners]);

  const hasAnyPartners =
    partners.length !== 0 ||
    pendingPartners.outgoing.length !== 0 ||
    pendingPartners.incoming.length !== 0;

  return (
    <>
      <Header as="h1">My partners</Header>
      <div style={{fontSize: '1.2em'}}>
        <p>
          Others can add you as a partner using your partner code{' '}
          <ClipboardText text={partnerCode} successText="Partner code copied">
            <code style={{backgroundColor: '#cef', padding: 5}}>{partnerCode}</code>
          </ClipboardText>
          <br />
          Once you are partners, you see each other's recipes and can copy them into your own
          account.
        </p>
      </div>

      {hasAnyPartners ? (
        <List divided relaxed>
          {partners.map(p => (
            <PartnerItem key={p.id} partner={p} />
          ))}
          {pendingPartners.outgoing.map(p => (
            <OutgoingPendingPartnerItem key={p.id} partner={p} />
          ))}
          {pendingPartners.incoming.map(p => (
            <IncomingPendingPartnerItem key={p.id} partner={p} />
          ))}
        </List>
      ) : (
        <Message content="You do not have any partners yet." warning />
      )}
      <AddPartner />
    </>
  );
};
