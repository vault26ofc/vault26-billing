import React, { useState, useEffect } from 'react';
import { useStore, store } from '../../services/store';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Tabs } from '../../components/ui/Tabs';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Printer, Save, Plus, Eye, EyeOff, ExternalLink, AlertTriangle } from 'lucide-react';
import { ALL_PERMISSIONS, DEFAULT_PERMISSIONS_BY_ROLE, PERMISSION_LABELS, PermissionKey, DbStaffRole } from '../../constants/permissions';
import { printThermalReceipt } from '../../utils/receiptPrinter';
import { EditInvoicePanel } from './EditInvoicePanel';
import { formatDateTime, toIstDateTime } from '../../utils/formatters';
import { useT } from '../../i18n';
import { WEBSITE_ADMIN_INVOICE_URL } from '../../constants/website';
import { loginEmail } from '../../api/auth';
import { roleWord } from '../../utils/roleWord';
import { StaffMember } from '../../types';

type Tab = 'SHOP' | 'TAX' | 'PRINTER' | 'STAFF' | 'EDIT_BILL';

// A username is what staff type to sign in: letters, numbers, dot, dash, underscore.
const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;

export const SettingsPage: React.FC = () => {
  const { settings, staff, currentStaff } = useStore();
  const t = useT();
  const isOwner = currentStaff?.role === 'OWNER';
  const [activeTab, setActiveTab] = useState<Tab>('SHOP');

  const [taxThreshold, setTaxThreshold] = useState(String(settings.taxThreshold));
  const [taxRateLow, setTaxRateLow] = useState(String(settings.taxRateLow));
  const [taxRateHigh, setTaxRateHigh] = useState(String(settings.taxRateHigh));
  const [printerName, setPrinterName] = useState(settings.printer?.name || '');
  const [saving, setSaving] = useState(false);

  // Settings arrive after this screen opens - copy them into the form once loaded.
  useEffect(() => {
    setTaxThreshold(String(settings.taxThreshold));
    setTaxRateLow(String(settings.taxRateLow));
    setTaxRateHigh(String(settings.taxRateHigh));
    setPrinterName(settings.printer?.name || '');
  }, [settings]);

  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffUsername, setNewStaffUsername] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [newDbStaffRole, setNewDbStaffRole] = useState<DbStaffRole>('BILLING');
  const [newStaffPermissions, setNewStaffPermissions] = useState<PermissionKey[]>(DEFAULT_PERMISSIONS_BY_ROLE.BILLING);
  const [isCreatingStaff, setIsCreatingStaff] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [showNewStaffPassword, setShowNewStaffPassword] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const threshold = Number(taxThreshold);
    const low = Number(taxRateLow);
    const high = Number(taxRateHigh);
    if (
      !Number.isFinite(threshold) || threshold < 0 ||
      !Number.isFinite(low) || low < 0 || low > 100 ||
      !Number.isFinite(high) || high < 0 || high > 100
    ) {
      store.addToast(t('GST numbers are not right'), t('The amount must be 0 or more, and both % between 0 and 100.'), 'error');
      return;
    }
    setSaving(true);
    try {
      await store.updateSettings({
        taxThreshold: threshold,
        taxRateLow: low,
        taxRateHigh: high,
        printer: { ...settings.printer, name: printerName },
      });
    } catch (err) {
      store.addToast(t('Settings not saved'), err instanceof Error ? err.message : undefined, 'error');
    } finally {
      setSaving(false);
    }
  };

  const [isTestPrinting, setIsTestPrinting] = useState(false);
  const handleTestPrint = async () => {
    setIsTestPrinting(true);
    try {
      // Hands a real print job to the browser's print window - the only thing
      // a web app can check. Whether paper comes out is up to the printer.
      const opened = await printThermalReceipt({
        orderNumber: 'TEST-PRINT',
        createdAt: toIstDateTime(new Date()),
        customerName: 'Test customer',
        items: [{ name: 'Test item', size: 'M', color: 'Black', quantity: 1, unitPrice: 999, total: 999 }],
        subtotal: 999,
        discount: 0,
        taxAmount: 0,
        grandTotal: 999,
        paymentMethod: 'CASH',
        storeSettings: {
          storeName: settings.brand || settings.storeName,
          tagline: settings.tagline,
          address: settings.address,
          cityState: settings.cityState,
          phone: settings.phone,
          gstin: settings.gstin,
          footer: settings.footer,
          taxRate: 0,
        },
      });
      if (opened) await store.testPrint();
      else store.addToast(t('Could not open printing'), t('Please try again.'), 'error');
    } finally {
      setIsTestPrinting(false);
    }
  };

  const handleRoleChange = (role: DbStaffRole) => {
    setNewDbStaffRole(role);
    setNewStaffPermissions(DEFAULT_PERMISSIONS_BY_ROLE[role]);
  };

  const toggleNewStaffPermission = (key: PermissionKey) => {
    setNewStaffPermissions((prev) => (prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]));
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    const username = newStaffUsername.trim().toLowerCase();
    if (!newStaffName.trim() || !USERNAME_RE.test(username) || newStaffPassword.length < 6) {
      store.addToast(
        t('Check the details'),
        t('Name, a username (3 or more letters or numbers, no spaces) and a password of 6 or more characters are needed.'),
        'error'
      );
      return;
    }
    setIsCreatingStaff(true);
    try {
      await store.createStaffMember({
        displayName: newStaffName.trim(),
        // The database signs people in by an email-shaped login; it is made
        // from the username and never shown or typed anywhere.
        email: loginEmail(username),
        password: newStaffPassword,
        role: newDbStaffRole,
        permissions: newStaffPermissions,
      });
      setIsStaffModalOpen(false);
      setNewStaffName('');
      setNewStaffUsername('');
      setNewStaffPassword('');
      setNewDbStaffRole('BILLING');
      setNewStaffPermissions(DEFAULT_PERMISSIONS_BY_ROLE.BILLING);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      store.addToast(
        t('Login not created'),
        /already registered|already exists/i.test(msg) ? t('This username is already taken.') : msg,
        'error'
      );
    } finally {
      setIsCreatingStaff(false);
    }
  };

  const tabs = [
    { id: 'SHOP', label: t('Shop details') },
    { id: 'TAX', label: t('GST') },
    { id: 'PRINTER', label: t('Printer') },
    { id: 'STAFF', label: t('Staff') },
    ...(isOwner ? [{ id: 'EDIT_BILL', label: t('Change a saved bill') }] : []),
  ];

  const detail = (label: string, value: string) => (
    <div className="py-3 grid grid-cols-1 sm:grid-cols-3 gap-1">
      <div className="label">{label}</div>
      <div className={`sm:col-span-2 text-base ${value ? 'font-bold' : 'text-status-red font-bold'}`}>{value || t('Not filled in')}</div>
    </div>
  );

  const roleOptions = [
    { value: 'BILLING', label: t('Cashier') },
    { value: 'FULFILLMENT', label: t('Packing staff') },
    { value: 'MANAGER', label: t('Manager') },
    { value: 'OWNER', label: t('Owner') },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl">{t('Settings & staff')}</h1>
      </div>

      <div className="card">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={(id) => setActiveTab(id as Tab)} className="px-2" />

        <div className="p-5">
          {activeTab === 'SHOP' && (
            <div className="space-y-4">
              <p className="text-base text-v26-muted">
                {t('These details print on every bill. They are kept in the Vault 26 website admin, so shop bills and website invoices always match.')}
              </p>
              {!settings.gstin && (
                <div className="flex gap-3 p-4 border border-status-amberBorder bg-status-amberBg text-status-amber text-base font-bold">
                  <AlertTriangle size={22} className="shrink-0" />
                  {t('GSTIN is not filled in yet. Add it in the Invoice template before giving GST bills.')}
                </div>
              )}
              <div className="divide-y divide-v26-line border-y border-v26-line">
                {detail(t('Shop name'), settings.brand)}
                {detail(t('Address'), [settings.address, settings.cityState].filter(Boolean).join(', '))}
                {detail(t('State'), settings.state)}
                {detail(t('Phone'), settings.phone)}
                {detail('GSTIN', settings.gstin)}
                {detail(t('Bill bottom line'), settings.footer)}
              </div>
              <Button
                variant="primary"
                icon={<ExternalLink size={18} />}
                onClick={() => window.open(WEBSITE_ADMIN_INVOICE_URL, '_blank', 'noopener')}
              >
                {t('Change in website admin')}
              </Button>
            </div>
          )}

          {activeTab === 'TAX' && (
            <form onSubmit={handleSave} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  label={t('Bill amount limit (₹)')}
                  type="number"
                  min={0}
                  value={taxThreshold}
                  onChange={(e) => setTaxThreshold(e.target.value)}
                />
                <Input
                  label={t('GST % up to the limit')}
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={taxRateLow}
                  onChange={(e) => setTaxRateLow(e.target.value)}
                />
                <Input
                  label={t('GST % above the limit')}
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={taxRateHigh}
                  onChange={(e) => setTaxRateHigh(e.target.value)}
                />
              </div>
              <div className="p-4 bg-v26-soft text-base">
                {t(
                  'GST is worked out on the bill amount after discount: up to ₹{limit} it is {low}%, above ₹{limit} it is {high}% (half CGST, half SGST). The owner can set a different % for one bill on the billing screen.',
                  { limit: taxThreshold, low: taxRateLow, high: taxRateHigh }
                )}
              </div>
              <div className="p-4 border border-v26-line text-base space-y-1">
                <div className="section-title">{t('Bill numbers')}</div>
                <div>
                  {t('Shop bills')}: <b>V26S-YYMM-0001</b>
                </div>
                <div>
                  {t('Website invoices (when delivered)')}: <b>V26W-YYMM-0001</b>
                </div>
                <div className="text-v26-muted">{t('Numbers start again from 0001 every month. They are given by the database, so there are no gaps.')}</div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" variant="primary" icon={<Save size={18} />} disabled={saving}>
                  {saving ? t('Saving…') : t('Save')}
                </Button>
              </div>
            </form>
          )}

          {activeTab === 'PRINTER' && (
            <form onSubmit={handleSave} className="space-y-5">
              <div className="flex flex-wrap items-center gap-2 text-base">
                <span className="label">{t('Last test print')}:</span>
                <span className="font-bold">
                  {settings.printer?.lastTestPrint ? formatDateTime(settings.printer.lastTestPrint) : t('Not tested yet')}
                </span>
              </div>
              <div className="p-4 bg-v26-soft text-base space-y-2">
                <p>{t('Connect the bill printer to this computer and install its driver, so it shows up as a normal printer.')}</p>
                <p>{t('When you print, the print window opens - choose the bill printer there.')}</p>
              </div>
              <Input label={t('Printer name (for your note)')} value={printerName} onChange={(e) => setPrinterName(e.target.value)} />
              <div className="flex flex-wrap justify-between gap-3">
                <Button type="button" variant="secondary" icon={<Printer size={18} />} onClick={handleTestPrint} disabled={isTestPrinting}>
                  {t('Test print')}
                </Button>
                <Button type="submit" variant="primary" icon={<Save size={18} />} disabled={saving}>
                  {saving ? t('Saving…') : t('Save')}
                </Button>
              </div>
            </form>
          )}

          {activeTab === 'STAFF' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-base text-v26-muted">
                  {isOwner ? t('Each person signs in with their own username and password.') : t('Only the owner can add or change staff logins.')}
                </p>
                {isOwner && (
                  <Button variant="primary" icon={<Plus size={18} />} onClick={() => setIsStaffModalOpen(true)}>
                    {t('Add staff')}
                  </Button>
                )}
              </div>

              <div className="overflow-x-auto border border-v26-line">
                <table className="w-full border-collapse text-base">
                  <thead>
                    <tr>
                      <th className="table-head py-3 px-4">{t('Name')}</th>
                      <th className="table-head py-3 px-4">{t('Job')}</th>
                      <th className="table-head py-3 px-4">{t('Can use')}</th>
                      <th className="table-head py-3 px-4">{t('Login')}</th>
                      {isOwner && <th className="table-head py-3 px-4 text-right"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-v26-line">
                    {staff.map((s) => (
                      <tr key={s.id}>
                        <td className="py-3 px-4 font-bold">{s.name}</td>
                        <td className="py-3 px-4">{t(roleWord(s.role))}</td>
                        <td className="py-3 px-4 text-v26-muted">
                          {s.role === 'OWNER' || s.permissions.length === ALL_PERMISSIONS.length
                            ? t('Everything')
                            : s.permissions.length === 0
                              ? t('Nothing yet')
                              : t('{a} of {b} screens', { a: s.permissions.length, b: ALL_PERMISSIONS.length })}
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge status={s.status === 'ACTIVE' ? 'ACTIVE' : 'OFFLINE'} />
                        </td>
                        {isOwner && (
                          <td className="py-3 px-4 text-right">
                            {s.id === currentStaff?.id ? (
                              <span className="text-sm text-v26-muted">({t('you')})</span>
                            ) : (
                              <Button variant="secondary" size="sm" onClick={() => setEditingStaffId(s.id)}>
                                {t('Change access')}
                              </Button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'EDIT_BILL' && isOwner && <EditInvoicePanel />}
        </div>
      </div>

      <Modal
        isOpen={isStaffModalOpen}
        onClose={() => setIsStaffModalOpen(false)}
        title={t('Add staff')}
        maxWidth="lg"
      >
        <form onSubmit={handleCreateStaff} className="space-y-4">
          <Input label={`${t('Name')} *`} required value={newStaffName} onChange={(e) => setNewStaffName(e.target.value)} autoFocus />
          <Input
            label={`${t('Username')} *`}
            required
            autoCapitalize="none"
            spellCheck={false}
            value={newStaffUsername}
            onChange={(e) => setNewStaffUsername(e.target.value.replace(/\s+/g, '').toLowerCase())}
            helperText={t('They type this to sign in. Letters and numbers, no spaces.')}
          />
          <Input
            label={`${t('Password')} *`}
            required
            type={showNewStaffPassword ? 'text' : 'password'}
            value={newStaffPassword}
            onChange={(e) => setNewStaffPassword(e.target.value)}
            helperText={t('6 or more characters.')}
            suffix={
              <button
                type="button"
                onClick={() => setShowNewStaffPassword((v) => !v)}
                className="pointer-events-auto text-v26-muted hover:text-v26-ink"
                aria-label={showNewStaffPassword ? t('Hide password') : t('Show password')}
              >
                {showNewStaffPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            }
          />
          <Select
            label={t('Job')}
            value={newDbStaffRole}
            onChange={(e) => handleRoleChange(e.target.value as DbStaffRole)}
            options={roleOptions}
          />
          <PermissionPicker value={newStaffPermissions} onToggle={toggleNewStaffPermission} />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setIsStaffModalOpen(false)}>
              {t('Cancel')}
            </Button>
            <Button type="submit" variant="primary" disabled={isCreatingStaff}>
              {isCreatingStaff ? t('Creating…') : t('Create login')}
            </Button>
          </div>
        </form>
      </Modal>

      {isOwner && editingStaffId && (
        <StaffAccessEditor
          key={editingStaffId}
          staffMember={staff.find((s) => s.id === editingStaffId)!}
          roleOptions={roleOptions}
          onClose={() => setEditingStaffId(null)}
        />
      )}
    </div>
  );
};

const PermissionPicker: React.FC<{ value: PermissionKey[]; onToggle: (k: PermissionKey) => void }> = ({ value, onToggle }) => {
  const t = useT();
  return (
    <fieldset>
      <legend className="label mb-2">{t('Screens this person can use')}</legend>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 border border-v26-line p-2">
        {ALL_PERMISSIONS.map((key) => (
          <label key={key} className="flex items-center gap-3 px-2 py-2 text-base cursor-pointer hover:bg-v26-soft">
            <input type="checkbox" checked={value.includes(key)} onChange={() => onToggle(key)} className="w-5 h-5 accent-v26-ink" />
            {t(PERMISSION_LABELS[key])}
          </label>
        ))}
      </div>
    </fieldset>
  );
};

const StaffAccessEditor: React.FC<{
  staffMember: StaffMember;
  roleOptions: { value: string; label: string }[];
  onClose: () => void;
}> = ({ staffMember, roleOptions, onClose }) => {
  const t = useT();
  const [role, setRole] = useState<DbStaffRole>(staffMember.role === 'ADMIN' ? 'OWNER' : (staffMember.role as DbStaffRole));
  const [permissions, setPermissions] = useState<PermissionKey[]>(staffMember.permissions as PermissionKey[]);
  const [isActive, setIsActive] = useState(staffMember.status === 'ACTIVE');
  const [saving, setSaving] = useState(false);

  const togglePermission = (key: PermissionKey) => {
    setPermissions((prev) => (prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await store.updateStaffPermissions(staffMember.id, { role, permissions, isActive });
      onClose();
    } catch (err) {
      store.addToast(t('Not saved'), err instanceof Error ? err.message : undefined, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t('Change access')}
      subtitle={staffMember.name}
      maxWidth="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? t('Saving…') : t('Save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select label={t('Job')} value={role} onChange={(e) => setRole(e.target.value as DbStaffRole)} options={roleOptions} />
        <label className="flex items-center gap-3 text-base cursor-pointer">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-5 h-5 accent-v26-ink" />
          {t('Login is on (turn off to stop this person signing in)')}
        </label>
        <PermissionPicker value={permissions} onToggle={togglePermission} />
      </div>
    </Modal>
  );
};
