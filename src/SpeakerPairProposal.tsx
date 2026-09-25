import { useMemo, useState } from 'react'
import { Button, Checkbox, FormControl, Heading, Select, TextInput } from '@primer/react'
import './SpeakerPairProposal.css'

type Person = { id: string; name: string; role: string; initials: string; color: string }

const initialPeople: Person[] = [
  { id: 'ada', name: 'Ada Lovelace', role: 'Mathematician · AI', initials: 'AL', color: '#8250df' },
  { id: 'grace', name: 'Grace Hopper', role: 'Computer scientist · Navy', initials: 'GH', color: '#0969da' },
  { id: 'katherine', name: 'Katherine Johnson', role: 'Mathematician · NASA', initials: 'KJ', color: '#bf3989' },
]

export default function SpeakerPairProposal() {
  const [people, setPeople] = useState(initialPeople)
  const [selection, setSelection] = useState(['ada', 'grace'])
  const [cardIds, setCardIds] = useState(['ada', 'grace'])
  const [perCard, setPerCard] = useState('2')
  const cardPeople = useMemo(() => people.filter((person) => cardIds.includes(person.id)), [people, cardIds])
  const available = Number(perCard)

  const updatePerson = (id: string, patch: Partial<Person>) => {
    setPeople((current) => current.map((person) => person.id === id ? { ...person, ...patch } : person))
  }

  const applySelection = () => {
    setCardIds(selection.slice(0, available))
  }

  const changeCardSize = (value: string) => {
    const limit = Number(value)
    setPerCard(value)
    setSelection((current) => current.slice(0, limit))
    setCardIds((current) => current.slice(0, limit))
  }

  return (
    <main className="proposal-shell">
      <header className="proposal-header">
        <div>
          <strong>Dev Days</strong>
          <span> / Speakers</span>
        </div>
        <span className="proposal-badge">UI proposal · not saved</span>
      </header>

      <div className="proposal-workspace">
        <section className="proposal-editor" aria-label="Speaker card editor proposal">
          <div className="proposal-title-row">
            <div>
              <Heading as="h1" className="proposal-heading">Speakers</Heading>
              <p>Choose who appears together on each card.</p>
            </div>
            <span className="proposal-count">{cardPeople.length} selected</span>
          </div>

          <FormControl id="proposal-speakers-per-card">
            <FormControl.Label>Speakers per card</FormControl.Label>
            <Select value={perCard} onChange={(event) => changeCardSize(event.target.value)}>
              <Select.Option value="1">One speaker per card</Select.Option>
              <Select.Option value="2">Two speakers per card</Select.Option>
            </Select>
          </FormControl>

          <fieldset className="proposal-catalogue">
            <legend>Speakers from Planning</legend>
            <p className="proposal-muted">Choose up to {available} speakers for this card.</p>
            {people.map((person) => (
              <label className="proposal-catalogue-person" key={person.id}>
                <Checkbox
                  checked={selection.includes(person.id)}
                  onChange={(event) => setSelection((current) => event.target.checked
                    ? [...current, person.id]
                    : current.filter((id) => id !== person.id))}
                />
                <span><strong>{person.name}</strong><small>{person.role}</small></span>
              </label>
            ))}
            <Button
              variant="primary"
              disabled={!selection.length || selection.length > available}
              onClick={applySelection}
            >
              Update card with selected speakers
            </Button>
          </fieldset>

          <div className="proposal-profile-list">
            <div className="proposal-list-heading">
              <strong>Card 1</strong>
              <span>{cardPeople.length} / {available} speakers</span>
            </div>
            {cardPeople.map((person, index) => (
              <article className="proposal-profile" key={person.id}>
                <span className="proposal-avatar" style={{ backgroundColor: person.color }}>{person.initials}</span>
                <div className="proposal-profile-fields">
                  <strong>Speaker {index + 1}</strong>
                  <FormControl id={`proposal-name-${person.id}`}>
                    <FormControl.Label>Name</FormControl.Label>
                    <TextInput block value={person.name} onChange={(event) => updatePerson(person.id, { name: event.target.value })} />
                  </FormControl>
                  <FormControl id={`proposal-role-${person.id}`}>
                    <FormControl.Label>Role</FormControl.Label>
                    <TextInput block value={person.role} onChange={(event) => updatePerson(person.id, { role: event.target.value })} />
                  </FormControl>
                </div>
              </article>
            ))}
            {!cardPeople.length && <p className="proposal-empty">Select at least one speaker to preview this card.</p>}
          </div>
        </section>

        <section className="proposal-preview" aria-label="Generated card preview">
          <div className="proposal-preview-toolbar">
            <div><strong>Card preview</strong><span>Square · 1080 × 1080</span></div>
            <span className="proposal-preview-status"><i /> Live preview</span>
          </div>
          <div className="proposal-card" aria-label={`Preview card with ${cardPeople.length} speakers`}>
            <div className="proposal-card-brand">GITHUB <span>DEV DAYS</span></div>
            <div className="proposal-card-title">Build what<br />comes next.</div>
            <div className={`proposal-card-speakers ${cardPeople.length === 1 ? 'single' : ''}`}>
              {cardPeople.map((person) => (
                <article className="proposal-card-speaker" key={person.id}>
                  <span className="proposal-card-avatar" style={{ backgroundColor: person.color }}>{person.initials}</span>
                  <strong>{person.name || 'Speaker name'}</strong>
                  <span>{person.role || 'Role'}</span>
                </article>
              ))}
              {!cardPeople.length && <span className="proposal-card-empty">Choose speakers to preview your card</span>}
            </div>
            <div className="proposal-card-footer">COPILOT DEV DAYS <span>Madrid · Apr 15</span></div>
          </div>
          <p className="proposal-preview-note">Each profile stays editable; the card preview shows the selected group together.</p>
        </section>
      </div>
    </main>
  )
}
