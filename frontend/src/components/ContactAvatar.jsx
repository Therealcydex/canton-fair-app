import { Avatar } from 'antd';

const initials = (name) => (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

// D63: a contact's photo, or its initials when it has none.
export default function ContactAvatar({ contact, size = 40 }) {
  return contact?.avatar
    ? <Avatar src={contact.avatar} size={size} alt="" className="flex-none" />
    : <Avatar size={size} className="contact-avatar-empty flex-none">{initials(contact?.name)}</Avatar>;
}
