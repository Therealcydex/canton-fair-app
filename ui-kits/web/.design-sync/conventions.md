# Sourcing — web UI kit (conventions)

This is the desktop back office used by the buyers and the admin. The UI text is **French**. The page shell comes from Bootstrap (via react-bootstrap), the content from **Ant Design 5**, and layout spacing from **Bootstrap utility classes**. Everything is on `window.SourcingWebUI`:

- `AppLayout`: the dark top navbar (Sourcing, Accueil, Fournisseurs, Contacts, À visiter, Stands, Produits, an "Administration" menu for admins, and the user menu) above a fluid container. It renders the current child route.
- `FormModal`: an Ant Design modal holding a form. It submits through `onSubmit(values)` (a Promise), keeps the server's message in an error `Alert` on failure, and has the buttons "Annuler" and "Enregistrer".
- `antd`: the Ant Design components the screens use: `Alert`, `App`, `Badge`, `Button`, `Card`, `Cascader`, `Col`, `ConfigProvider`, `Descriptions`, `Empty`, `Form`, `Image`, `Input`, `InputNumber`, `Modal`, `Popconfirm`, `Rate`, `Result`, `Row`, `Select`, `Space`, `Spin`, `Switch`, `Table`, `Tabs`, `Tag`, `Tooltip` and `Upload`. Build page content from these; don't hand-make tables, inputs or buttons.
- `WebRoot`, `Routes`, `Route`, `Link`: the setup pieces below.

## Setup

**Wrap every design in `WebRoot`.** It is the app's own provider chain: Ant Design's French locale, `App` (for `message`/`modal`), the signed-in user `AppLayout` shows (`user` prop; the default is an admin, "Sami Ben Ali · Groupe Tarek - Tunis"), and a `MemoryRouter` (`initialPath` prop). Without it, `AppLayout` crashes (no user, no router). Don't add another router. For a full screen, use `AppLayout` as a layout route:

```jsx
const { WebRoot, Routes, Route, AppLayout, antd } = window.SourcingWebUI;
const { Button, Space, Table, Tag } = antd;
<WebRoot initialPath="/produits">
  <Routes>
    <Route element={<AppLayout />}>
      <Route path="*" element={<>
        <Space className="mb-3 w-100 justify-content-between" wrap>
          <h1 className="h4 m-0">Produits</h1>
          <Button type="primary">Nouveau produit</Button>
        </Space>
        <Table rowKey="id" size="middle" pagination={false}
          columns={[{ title: 'Nom', dataIndex: 'name' }, { title: 'Prix', dataIndex: 'price' },
                    { title: 'Expédition', dataIndex: 'ship', render: (v) => <Tag>{v}</Tag> }]}
          dataSource={[{ id: 1, name: 'Lampe LED solaire 20 W', price: '3,80', ship: 'FOB' }]} />
      </>} />
    </Route>
  </Routes>
</WebRoot>
```

For a modal, pass Ant Design `Form.Item`s as the children of `FormModal`, for example `<Form.Item name="name" label="Nom" rules={[{ required: true, message: 'Le nom est obligatoire' }]}><Input /></Form.Item>`. Use `Row`/`Col xs={24} sm={12}` with `gutter={12}` for two columns.

## Styling idiom

- **Components are styled through Ant Design props**, not classes: `Button type="primary"`, `Table size="middle"`, `Alert type="error" showIcon`, `Tag color="green"`, `Space wrap`.
- **Layout spacing uses Bootstrap 5 utilities**, exactly as the app does. Page title: `h1.h4.m-0`. Header row: `Space` with `mb-3 w-100 justify-content-between`. Vertical rhythm: `mb-2` and `mb-3`. Secondary text: `text-muted small`. Empty or centered blocks: `text-center py-5`. A full-page centered card (login): `d-flex justify-content-center align-items-center min-vh-100 bg-light px-3`.
- There are no design tokens. The colors are Ant Design's defaults (primary blue `#1677ff`) and Bootstrap's dark navbar.

Read `styles.css` (Bootstrap plus the app's `index.css`) and `components/<group>/<Name>/<Name>.prompt.md`. Ant Design's styles are injected at runtime by the bundle.
