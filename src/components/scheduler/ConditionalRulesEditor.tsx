import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X, Plus } from 'lucide-react';

export interface ConditionalRule {
  id: string;
  ruleType: 'sov_threshold' | 'last_run_hours' | 'skip_if_recent';
  config: {
    threshold?: number;
    operator?: 'less_than' | 'greater_than';
    hours?: number;
  };
}

interface ConditionalRulesEditorProps {
  rules: ConditionalRule[];
  onRulesChange: (rules: ConditionalRule[]) => void;
}

export default function ConditionalRulesEditor({
  rules,
  onRulesChange,
}: ConditionalRulesEditorProps) {
  const addRule = () => {
    const newRule: ConditionalRule = {
      id: `rule-${Date.now()}`,
      ruleType: 'sov_threshold',
      config: {
        threshold: 30,
        operator: 'less_than',
      },
    };
    onRulesChange([...rules, newRule]);
  };

  const removeRule = (ruleId: string) => {
    onRulesChange(rules.filter(r => r.id !== ruleId));
  };

  const updateRuleType = (
    ruleId: string,
    newType: 'sov_threshold' | 'last_run_hours' | 'skip_if_recent'
  ) => {
    onRulesChange(
      rules.map(rule =>
        rule.id === ruleId
          ? {
              ...rule,
              ruleType: newType,
              config:
                newType === 'sov_threshold'
                  ? { threshold: 30, operator: 'less_than' as const }
                  : { hours: 24 },
            }
          : rule
      )
    );
  };

  const updateThreshold = (ruleId: string, threshold: number) => {
    onRulesChange(
      rules.map(rule =>
        rule.id === ruleId
          ? { ...rule, config: { ...rule.config, threshold } }
          : rule
      )
    );
  };

  const updateOperator = (ruleId: string, operator: 'less_than' | 'greater_than') => {
    onRulesChange(
      rules.map(rule =>
        rule.id === ruleId
          ? { ...rule, config: { ...rule.config, operator } }
          : rule
      )
    );
  };

  const updateHours = (ruleId: string, hours: number) => {
    onRulesChange(
      rules.map(rule =>
        rule.id === ruleId ? { ...rule, config: { ...rule.config, hours } } : rule
      )
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Conditional Execution Rules</CardTitle>
        <CardDescription>
          Only execute this schedule when specific conditions are met
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rules.length === 0 ? (
          <div className="text-sm text-gray-500 py-4 text-center">
            No conditional rules. Schedule will always run when triggered.
          </div>
        ) : (
          rules.map(rule => (
            <div key={rule.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Select
                  value={rule.ruleType}
                  onValueChange={(v: any) => updateRuleType(rule.id, v)}
                >
                  <SelectTrigger className="w-[280px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sov_threshold">
                      Run only if SOV is below threshold
                    </SelectItem>
                    <SelectItem value="last_run_hours">
                      Skip if run within X hours
                    </SelectItem>
                    <SelectItem value="skip_if_recent">
                      Skip if last audit was recent
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRule(rule.id)}
                >
                  <X className="h-4 w-4 text-gray-400 hover:text-red-600" />
                </Button>
              </div>

              {rule.ruleType === 'sov_threshold' && (
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Run if SOV is</Label>
                  <Select
                    value={rule.config.operator || 'less_than'}
                    onValueChange={(v: any) => updateOperator(rule.id, v)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="less_than">less than</SelectItem>
                      <SelectItem value="greater_than">greater than</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    value={rule.config.threshold || 30}
                    onChange={e => updateThreshold(rule.id, Number(e.target.value))}
                    className="w-20"
                    min={0}
                    max={100}
                  />
                  <span className="text-sm">%</span>
                </div>
              )}

              {(rule.ruleType === 'last_run_hours' ||
                rule.ruleType === 'skip_if_recent') && (
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Skip if last run was within</Label>
                  <Input
                    type="number"
                    value={rule.config.hours || 24}
                    onChange={e => updateHours(rule.id, Number(e.target.value))}
                    className="w-20"
                    min={1}
                  />
                  <span className="text-sm">hours</span>
                </div>
              )}
            </div>
          ))
        )}

        <Button onClick={addRule} variant="outline" className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Add Conditional Rule
        </Button>
      </CardContent>
    </Card>
  );
}
