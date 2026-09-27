import React, { useState } from 'react';
import { DeviceContact } from '../types/assistant';
import { deviceActionBridge } from '../services/deviceActionBridge';
import { Users, Phone, UserPlus, Trash2 } from 'lucide-react';

interface ContactManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectContactToCall?: (contact: DeviceContact) => void;
}

export const ContactManagerModal: React.FC<ContactManagerModalProps> = ({
  isOpen,
  onClose,
  onSelectContactToCall,
}) => {
  const [contacts, setContacts] = useState<DeviceContact[]>(() =>
    deviceActionBridge.getContacts()
  );
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRel, setNewRel] = useState('');

  if (!isOpen) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) return;

    const colors = ['#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    deviceActionBridge.addContact({
      name: newName.trim(),
      phone: newPhone.trim(),
      relationship: newRel.trim() || undefined,
      avatarColor: randomColor,
    });

    setContacts(deviceActionBridge.getContacts());
    setNewName('');
    setNewPhone('');
    setNewRel('');
    setShowAddForm(false);
  };

  const handleDelete = (id: string) => {
    deviceActionBridge.deleteContact(id);
    setContacts(deviceActionBridge.getContacts());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl flex flex-col shadow-2xl overflow-hidden text-slate-100">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            <h3 className="font-semibold text-base text-white">Device Contacts</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-4 bg-slate-950/40 border-b border-slate-800 text-xs text-slate-300">
          <p>
            Arushi uses these device contacts when you speak commands like{' '}
            <span className="text-indigo-300 font-semibold">&ldquo;Call Mom&rdquo;</span>,{' '}
            <span className="text-indigo-300 font-semibold">&ldquo;Rahul ko call karo&rdquo;</span>, or{' '}
            <span className="text-indigo-300 font-semibold">&ldquo;Mummy ko phone lagao&rdquo;</span>.
          </p>
          <p className="mt-1 text-slate-400">
            Notice how there are two Rahuls (Rahul Sharma &amp; Rahul Verma) to safely test disambiguation without guessing!
          </p>
        </div>

        <div className="flex-1 p-4 overflow-y-auto max-h-80 space-y-2.5">
          {contacts.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 hover:border-slate-600 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm shadow"
                  style={{ backgroundColor: c.avatarColor || '#6366f1' }}
                >
                  {c.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="font-medium text-white flex items-center gap-2">
                    {c.name}
                    {c.relationship && (
                      <span className="text-[11px] text-slate-400 font-normal">
                        ({c.relationship})
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 font-mono">{c.phone}</div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {onSelectContactToCall && (
                  <button
                    onClick={() => {
                      onSelectContactToCall(c);
                      onClose();
                    }}
                    title="Test Call"
                    className="p-2 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 transition-colors"
                  >
                    <Phone className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(c.id)}
                  title="Delete Contact"
                  className="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-700/40 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {showAddForm ? (
          <form onSubmit={handleAdd} className="p-4 bg-slate-950/80 border-t border-slate-800 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Add New Contact</h4>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Full Name (e.g. Priya)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                required
              />
              <input
                type="text"
                placeholder="Phone (e.g. +919876543210)"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
            <input
              type="text"
              placeholder="Relationship / Tag (e.g. Sister, Doctor)"
              value={newRel}
              onChange={(e) => setNewRel(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg"
              >
                Save Contact
              </button>
            </div>
          </form>
        ) : (
          <div className="p-3 bg-slate-950 border-t border-slate-800 flex justify-between items-center">
            <button
              onClick={() => setShowAddForm(true)}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-indigo-950/40 transition-colors"
            >
              <UserPlus className="w-4 h-4" /> Add Custom Contact
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium rounded-lg"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
