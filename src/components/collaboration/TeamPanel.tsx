import { useState } from 'react';
import type { TeamMember, TeamRole } from '../../types';
import { Avatar } from '../common/Avatar';
import { RoleBadge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { PlusIcon, UsersIcon, TrashIcon } from '../common/Icons';
import { teamRoles } from '../../data/roles';

interface TeamFormProps {
  member?: TeamMember;
  onSubmit: (data: { name: string; email?: string; role: TeamRole }) => void;
  onCancel: () => void;
}

function TeamForm({ member, onSubmit, onCancel }: TeamFormProps) {
  const [name, setName] = useState(member?.name ?? '');
  const [email, setEmail] = useState(member?.email ?? '');
  const [role, setRole] = useState<TeamRole>(member?.role ?? 'writer');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit({ name: name.trim(), email: email.trim() || undefined, role });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="form-label">Name *</label>
        <input
          type="text"
          className="form-input"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Team member name"
          autoFocus
        />
        {errors.name && <p className="form-error">{errors.name}</p>}
      </div>

      <div className="form-group">
        <label className="form-label">Email</label>
        <input
          type="email"
          className="form-input"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="email@example.com"
        />
      </div>

      <div className="form-group">
        <label className="form-label">Role</label>
        <select
          className="form-select"
          value={role}
          onChange={e => setRole(e.target.value as TeamRole)}
        >
          {teamRoles.map(r => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <p className="form-hint">
          {teamRoles.find(r => r.id === role)?.description}
        </p>
      </div>

      <div className="flex justify-between gap-sm mt-lg">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary">
          {member ? 'Save Changes' : 'Add Member'}
        </button>
      </div>
    </form>
  );
}

interface TeamPanelProps {
  members: TeamMember[];
  onAddMember: (data: { name: string; email?: string; role: TeamRole }) => void;
  onDeleteMember: (id: string) => void;
}

export function TeamPanel({ members, onAddMember, onDeleteMember }: TeamPanelProps) {
  const [showAddModal, setShowAddModal] = useState(false);

  const handleAdd = (data: { name: string; email?: string; role: TeamRole }) => {
    onAddMember(data);
    setShowAddModal(false);
  };

  return (
    <>
      <div className="flex justify-between items-center mb-lg">
        <h2>Team</h2>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          <PlusIcon />
          Add Member
        </button>
      </div>

      {members.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <UsersIcon />
            <h3>No team members yet</h3>
            <p>Add team members to assign roles and collaborate on video production.</p>
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
              <PlusIcon />
              Add First Member
            </button>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-body" style={{ padding: 0 }}>
            {members.map((member, i) => (
              <div
                key={member.id}
                className="flex items-center justify-between"
                style={{
                  padding: 'var(--spacing-md) var(--spacing-lg)',
                  borderBottom: i < members.length - 1 ? '1px solid #E5E7EB' : undefined,
                }}
              >
                <div className="flex items-center gap-md">
                  <Avatar member={member} size="lg" />
                  <div>
                    <div className="font-medium">{member.name}</div>
                    {member.email && (
                      <div className="text-sm text-gray">{member.email}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-md">
                  <RoleBadge role={member.role} />
                  <button
                    className="btn btn-ghost btn-icon"
                    onClick={() => onDeleteMember(member.id)}
                    title="Remove member"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Team Member"
      >
        <TeamForm
          onSubmit={handleAdd}
          onCancel={() => setShowAddModal(false)}
        />
      </Modal>
    </>
  );
}
