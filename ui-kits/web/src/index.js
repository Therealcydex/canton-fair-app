// Entry of the web UI kit for Claude Design: the app's own components, re-exported as is.
import './process-shim';
import {
  Alert, App, Badge, Button, Card, Cascader, Col, ConfigProvider, Descriptions, Empty, Form, Image, Input, InputNumber,
  Modal, Popconfirm, Rate, Result, Row, Select, Space, Spin, Switch, Table, Tabs, Tag, Tooltip, Upload,
} from 'antd';

export { default as AppLayout } from '../../../frontend/src/components/AppLayout';
export { default as FormModal } from '../../../frontend/src/components/FormModal';
export { WebRoot } from './WebRoot';
export { Routes, Route, Link } from 'react-router-dom';

// The Ant Design components the screens use (frontend/src/feature-module), for designs.
export const antd = {
  Alert, App, Badge, Button, Card, Cascader, Col, ConfigProvider, Descriptions, Empty, Form, Image, Input, InputNumber,
  Modal, Popconfirm, Rate, Result, Row, Select, Space, Spin, Switch, Table, Tabs, Tag, Tooltip, Upload,
};
