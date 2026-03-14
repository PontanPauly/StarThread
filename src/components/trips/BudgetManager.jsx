import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, DollarSign, Trash2, Edit, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function BudgetManager({ tripId, people }) {
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [showGlobalBalances, setShowGlobalBalances] = useState(false);
  const queryClient = useQueryClient();

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses', tripId],
    queryFn: () => base44.entities.Expense.filter({ trip_id: tripId }),
  });

  const deleteExpense = useMutation({
    mutationFn: (id) => base44.entities.Expense.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['expenses', tripId]),
  });

  const totalExpenses = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

  const balances = React.useMemo(() => {
    const balance = {};
    people.forEach(p => balance[p.id] = 0);

    expenses.forEach(expense => {
      const amount = parseFloat(expense.amount) || 0;
      balance[expense.paid_by_person_id] = (balance[expense.paid_by_person_id] || 0) + amount;

      const splitIds = expense.split_among_ids || [expense.paid_by_person_id];
      const splitCount = (splitIds && splitIds.length > 0) ? splitIds.length : 1;
      const perPerson = amount / splitCount;
      splitIds.forEach(personId => {
        balance[personId] = (balance[personId] || 0) - perPerson;
      });
    });

    return balance;
  }, [expenses, people]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">Budget</h3>
          <p className="text-2xl font-bold text-amber-400">${totalExpenses.toFixed(2)}</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-amber-500 hover:bg-amber-600 text-slate-900">
          <Plus className="w-4 h-4 mr-2" />
          Add Expense
        </Button>
      </div>

      <div className="glass-card rounded-xl p-4">
        <button
          onClick={() => setShowGlobalBalances(!showGlobalBalances)}
          className="w-full flex justify-between items-center text-sm font-semibold text-slate-400 hover:text-slate-200 transition-colors"
        >
          <span>Overall Balances</span>
          {showGlobalBalances ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showGlobalBalances && (
          <div className="space-y-2 mt-3">
            {people.map(person => {
              const bal = balances[person.id] || 0;
              return (
                <div key={person.id} className="flex justify-between items-center">
                  <span className="text-slate-300">{person.name}</span>
                  <span className={bal > 0 ? 'text-green-400' : bal < 0 ? 'text-red-400' : 'text-slate-500'}>
                    {bal > 0 ? '+' : ''}${Math.abs(bal).toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {expenses.map(expense => (
          <ExpenseCard
            key={expense.id}
            expense={expense}
            people={people}
            onEdit={() => {
              setEditingExpense(expense);
              setShowForm(true);
            }}
            onDelete={() => deleteExpense.mutate(expense.id)}
          />
        ))}
      </div>

      {expenses.length === 0 && (
        <div className="glass-card rounded-lg p-8 text-center">
          <DollarSign className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No expenses yet. Add your first expense to start tracking.</p>
        </div>
      )}

      {showForm && (
        <ExpenseForm
          tripId={tripId}
          people={people}
          expense={editingExpense}
          onClose={() => {
            setShowForm(false);
            setEditingExpense(null);
          }}
          onSuccess={() => {
            setShowForm(false);
            setEditingExpense(null);
            queryClient.invalidateQueries(['expenses', tripId]);
          }}
        />
      )}
    </div>
  );
}

function ExpenseCard({ expense, people, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(true);
  const paidBy = people.find(p => p.id === expense.paid_by_person_id);
  const amount = parseFloat(expense.amount) || 0;
  const splitIds = expense.split_among_ids || [expense.paid_by_person_id];
  const splitCount = (splitIds && splitIds.length > 0) ? splitIds.length : 1;
  const perPerson = amount / splitCount;

  return (
    <div className="glass-card rounded-lg overflow-hidden">
      <div className="p-4 flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-slate-200">{expense.description}</h4>
            {expense.category && (
              <Badge className="text-xs capitalize">{expense.category}</Badge>
            )}
          </div>
          <div className="flex gap-2 mt-1 text-sm text-slate-500">
            <span>Paid by <span className="text-amber-400">{paidBy?.name || 'Unknown'}</span></span>
            {expense.date && (
              <>
                <span>•</span>
                <span>{format(new Date(expense.date), 'MMM d')}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-amber-400">${amount.toFixed(2)}</span>
          <Button variant="ghost" size="icon" onClick={onEdit} className="text-slate-400 hover:text-slate-200 h-8 w-8">
            <Edit className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete} className="text-red-400 hover:text-red-300 h-8 w-8">
            <Trash2 className="w-4 h-4" />
          </Button>
          <button onClick={() => setExpanded(!expanded)} className="text-slate-400 hover:text-slate-200 p-1">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {expanded && splitIds.length > 0 && (
        <div className="px-4 pb-4 border-t border-slate-700/50 pt-3">
          <p className="text-xs text-slate-500 mb-2">
            Split among {splitCount} {splitCount === 1 ? 'person' : 'people'} - ${perPerson.toFixed(2)} each
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {splitIds.map(personId => {
              const person = people.find(p => p.id === personId);
              const isPayer = personId === expense.paid_by_person_id;
              const owes = perPerson;
              const net = isPayer ? (amount - perPerson) : -perPerson;

              return (
                <div
                  key={personId}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-800/50 text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs text-slate-400">{person?.name?.charAt(0) || '?'}</span>
                    </div>
                    <span className="text-slate-300 truncate">{person?.name || 'Unknown'}</span>
                  </div>
                  <span className={`flex-shrink-0 ml-2 font-medium ${net > 0.01 ? 'text-green-400' : net < -0.01 ? 'text-red-400' : 'text-slate-500'}`}>
                    {net > 0.01 ? `+$${net.toFixed(2)}` : net < -0.01 ? `-$${Math.abs(net).toFixed(2)}` : '$0.00'}
                  </span>
                </div>
              );
            })}
          </div>
          {paidBy && !splitIds.includes(expense.paid_by_person_id) && (
            <div className="mt-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20 text-sm">
              <span className="text-green-400">{paidBy.name} paid ${amount.toFixed(2)} (not splitting)</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ExpenseForm({ tripId, people, expense, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    description: expense?.description || '',
    amount: expense?.amount || '',
    paid_by_person_id: expense?.paid_by_person_id || '',
    split_among_ids: expense?.split_among_ids || people.map(p => p.id),
    category: expense?.category || 'other',
    date: expense?.date || new Date().toISOString().split('T')[0],
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const dataToSave = {
      trip_id: tripId,
      description: formData.description,
      amount: parseFloat(formData.amount),
      paid_by_person_id: formData.paid_by_person_id,
      split_among_ids: formData.split_among_ids,
      category: formData.category,
      date: formData.date || null,
    };
    
    if (expense?.id) {
      await base44.entities.Expense.update(expense.id, dataToSave);
    } else {
      await base44.entities.Expense.create(dataToSave);
    }
    onSuccess();
  };

  const toggleSplit = (personId) => {
    const current = formData.split_among_ids;
    if (current.includes(personId)) {
      setFormData({ ...formData, split_among_ids: current.filter(id => id !== personId) });
    } else {
      setFormData({ ...formData, split_among_ids: [...current, personId] });
    }
  };

  const perPerson = formData.split_among_ids.length > 0 && formData.amount
    ? (parseFloat(formData.amount) / formData.split_among_ids.length).toFixed(2)
    : '0.00';

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-slate-100">{expense ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-slate-300">Description</Label>
            <Input
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="bg-slate-800 border-slate-700 text-slate-100"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-300">Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="bg-slate-800 border-slate-700 text-slate-100"
                required
              />
            </div>
            <div>
              <Label className="text-slate-300">Date</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="bg-slate-800 border-slate-700 text-slate-100"
              />
            </div>
          </div>

          <div>
            <Label className="text-slate-300">Category</Label>
            <Select value={formData.category} onValueChange={(val) => setFormData({ ...formData, category: val })}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="food">Food</SelectItem>
                <SelectItem value="lodging">Lodging</SelectItem>
                <SelectItem value="transportation">Transportation</SelectItem>
                <SelectItem value="activities">Activities</SelectItem>
                <SelectItem value="supplies">Supplies</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-slate-300">Paid By</Label>
            <Select value={formData.paid_by_person_id} onValueChange={(val) => setFormData({ ...formData, paid_by_person_id: val })}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
                <SelectValue placeholder="Select person" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {people.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-slate-300">Split Among</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {people.map(person => (
                <Badge
                  key={person.id}
                  onClick={() => toggleSplit(person.id)}
                  className={`cursor-pointer ${
                    formData.split_among_ids.includes(person.id)
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      : 'bg-slate-700 text-slate-400 border-slate-600'
                  }`}
                >
                  {person.name}
                </Badge>
              ))}
            </div>
            {formData.split_among_ids.length > 0 && formData.amount && (
              <p className="text-xs text-slate-500 mt-2">
                ${perPerson} each ({formData.split_among_ids.length} {formData.split_among_ids.length === 1 ? 'person' : 'people'})
              </p>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-slate-900">
              {expense ? 'Update Expense' : 'Add Expense'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
