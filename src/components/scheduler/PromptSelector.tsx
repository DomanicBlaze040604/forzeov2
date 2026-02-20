import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Prompt {
  id: string;
  prompt_text: string;
  category: string;
  client_id: string;
  is_active: boolean;
}

interface PromptSelectorProps {
  selectedClientIds: string[];
  selectionType: 'all' | 'category' | 'custom';
  selectedCategories: string[];
  selectedPromptIds: string[];
  onSelectionTypeChange: (type: 'all' | 'category' | 'custom') => void;
  onCategoriesChange: (categories: string[]) => void;
  onPromptIdsChange: (promptIds: string[]) => void;
}

interface PromptBreakdown {
  total: number;
  byClient: Record<string, { brand_name: string; count: number }>;
  byCategory: Record<string, number>;
}

export default function PromptSelector({
  selectedClientIds,
  selectionType,
  selectedCategories,
  selectedPromptIds,
  onSelectionTypeChange,
  onCategoriesChange,
  onPromptIdsChange,
}: PromptSelectorProps) {
  const [allPrompts, setAllPrompts] = useState<Prompt[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [breakdown, setBreakdown] = useState<PromptBreakdown>({
    total: 0,
    byClient: {},
    byCategory: {},
  });
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);

  // Fetch all prompts for selected clients
  useEffect(() => {
    if (selectedClientIds.length > 0) {
      fetchPrompts();
    } else {
      setAllPrompts([]);
      setCategories([]);
      setBreakdown({ total: 0, byClient: {}, byCategory: {} });
    }
  }, [selectedClientIds]);

  // Recalculate breakdown when selection changes
  useEffect(() => {
    calculateBreakdown();
  }, [allPrompts, selectionType, selectedCategories, selectedPromptIds]);

  const fetchPrompts = async () => {
    try {
      // Fetch prompts
      const { data: promptsData, error: promptsError } = await supabase
        .from('prompts')
        .select('*')
        .in('client_id', selectedClientIds)
        .eq('is_active', true);

      if (promptsError) throw promptsError;

      setAllPrompts(promptsData || []);

      // Extract unique categories
      const uniqueCategories = Array.from(
        new Set(promptsData?.map((p: any) => p.category).filter(Boolean) || [])
      ).sort() as string[];
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Failed to fetch prompts:', error);
    }
  };

  const calculateBreakdown = async () => {
    if (selectedClientIds.length === 0) {
      setBreakdown({ total: 0, byClient: {}, byCategory: {} });
      return;
    }

    try {
      // Fetch client names for breakdown
      const { data: clients } = await supabase
        .from('clients')
        .select('id, brand_name')
        .in('id', selectedClientIds);

      const clientMap = new Map(clients?.map((c: any) => [c.id, c.brand_name]) || []);

      let filteredPrompts = allPrompts;

      // Filter based on selection type
      if (selectionType === 'category' && selectedCategories.length > 0) {
        filteredPrompts = allPrompts.filter(p => selectedCategories.includes(p.category));
      } else if (selectionType === 'custom' && selectedPromptIds.length > 0) {
        filteredPrompts = allPrompts.filter(p => selectedPromptIds.includes(p.id));
      }

      // Calculate breakdown by client
      const byClient: Record<string, { brand_name: string; count: number }> = {};
      for (const clientId of selectedClientIds) {
        const count = filteredPrompts.filter(p => p.client_id === clientId).length;
        byClient[clientId] = {
          brand_name: clientMap.get(clientId) || 'Unknown',
          count,
        };
      }

      // Calculate breakdown by category
      const byCategory: Record<string, number> = {};
      for (const prompt of filteredPrompts) {
        byCategory[prompt.category] = (byCategory[prompt.category] || 0) + 1;
      }

      setBreakdown({
        total: filteredPrompts.length,
        byClient,
        byCategory,
      });
    } catch (error) {
      console.error('Failed to calculate breakdown:', error);
    }
  };

  const toggleCategory = (category: string) => {
    const newCategories = selectedCategories.includes(category)
      ? selectedCategories.filter(c => c !== category)
      : [...selectedCategories, category];
    onCategoriesChange(newCategories);
  };

  const togglePrompt = (promptId: string) => {
    const newPromptIds = selectedPromptIds.includes(promptId)
      ? selectedPromptIds.filter(id => id !== promptId)
      : [...selectedPromptIds, promptId];
    onPromptIdsChange(newPromptIds);
  };

  return (
    <div className="space-y-4">
      {/* Selection Type Radio Group */}
      <RadioGroup value={selectionType} onValueChange={onSelectionTypeChange}>
        <div className="space-y-3">
          {/* All Prompts */}
          <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50">
            <RadioGroupItem value="all" id="all" />
            <Label htmlFor="all" className="flex-1 cursor-pointer">
              <div className="font-medium">All Active Prompts</div>
              <div className="text-sm text-gray-500">
                Run all active prompts for each selected brand
              </div>
            </Label>
            {selectionType === 'all' && (
              <Badge variant="secondary">{breakdown.total} prompts</Badge>
            )}
          </div>

          {/* By Category */}
          <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50">
            <RadioGroupItem value="category" id="category" />
            <Label htmlFor="category" className="flex-1 cursor-pointer">
              <div className="font-medium">By Category</div>
              <div className="text-sm text-gray-500">
                Select specific prompt categories to run
              </div>
            </Label>
            {selectionType === 'category' && (
              <Badge variant="secondary">{breakdown.total} prompts</Badge>
            )}
          </div>

          {/* Custom Selection */}
          <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50">
            <RadioGroupItem value="custom" id="custom" />
            <Label htmlFor="custom" className="flex-1 cursor-pointer">
              <div className="font-medium">Custom Selection</div>
              <div className="text-sm text-gray-500">
                Manually pick individual prompts
              </div>
            </Label>
            {selectionType === 'custom' && (
              <Badge variant="secondary">{breakdown.total} prompts</Badge>
            )}
          </div>
        </div>
      </RadioGroup>

      {/* Category Selection (when type = 'category') */}
      {selectionType === 'category' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Select Categories</CardTitle>
            <CardDescription>
              Choose which prompt categories to include in the schedule
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {categories.length === 0 ? (
              <div className="text-sm text-gray-500 py-4">
                No categories available for selected brands
              </div>
            ) : (
              categories.map(category => {
                const categoryCount = allPrompts.filter(p => p.category === category).length;
                return (
                  <div
                    key={category}
                    className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded"
                  >
                    <Checkbox
                      id={`category-${category}`}
                      checked={selectedCategories.includes(category)}
                      onCheckedChange={() => toggleCategory(category)}
                    />
                    <Label
                      htmlFor={`category-${category}`}
                      className="flex-1 cursor-pointer capitalize"
                    >
                      {category.replace('_', ' ')}
                    </Label>
                    <Badge variant="outline">{categoryCount} prompts</Badge>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      )}

      {/* Custom Prompt Selection (when type = 'custom') */}
      {selectionType === 'custom' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Select Individual Prompts</CardTitle>
            <CardDescription>
              Choose specific prompts to run across all selected brands
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {allPrompts.length === 0 ? (
                  <div className="text-sm text-gray-500 py-4">
                    No prompts available for selected brands
                  </div>
                ) : (
                  allPrompts.map(prompt => (
                    <div
                      key={prompt.id}
                      className="flex items-start space-x-2 p-2 hover:bg-gray-50 rounded"
                    >
                      <Checkbox
                        id={`prompt-${prompt.id}`}
                        checked={selectedPromptIds.includes(prompt.id)}
                        onCheckedChange={() => togglePrompt(prompt.id)}
                        className="mt-1"
                      />
                      <Label
                        htmlFor={`prompt-${prompt.id}`}
                        className="flex-1 cursor-pointer"
                      >
                        <div className="text-sm">{prompt.prompt_text}</div>
                        <div className="text-xs text-gray-500 capitalize">
                          {prompt.category.replace('_', ' ')}
                        </div>
                      </Label>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Prompt Breakdown Summary */}
      {breakdown.total > 0 && (
        <Card>
          <Collapsible open={isBreakdownOpen} onOpenChange={setIsBreakdownOpen}>
            <CardHeader className="pb-3">
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isBreakdownOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <CardTitle className="text-base">
                      Execution Preview: {breakdown.total} total prompts
                    </CardTitle>
                  </div>
                  <Badge>{selectedClientIds.length} brands</Badge>
                </div>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                {/* Per-brand breakdown */}
                <div>
                  <div className="text-sm font-medium mb-2">Prompts per Brand:</div>
                  <div className="space-y-1">
                    {Object.entries(breakdown.byClient).map(([clientId, data]) => (
                      <div
                        key={clientId}
                        className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded"
                      >
                        <span>{data.brand_name}</span>
                        <Badge variant="outline">{data.count} prompts</Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Category breakdown */}
                {Object.keys(breakdown.byCategory).length > 0 && (
                  <div>
                    <div className="text-sm font-medium mb-2">Prompts by Category:</div>
                    <div className="space-y-1">
                      {Object.entries(breakdown.byCategory).map(([category, count]) => (
                        <div
                          key={category}
                          className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded"
                        >
                          <span className="capitalize">{category.replace('_', ' ')}</span>
                          <Badge variant="outline">{count} prompts</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Estimated execution time */}
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-sm text-blue-900">
                    <strong>Estimated time:</strong>{' '}
                    {Math.ceil((breakdown.total * 37) / 60)} minutes
                    <span className="text-xs ml-2">(~37 seconds per prompt)</span>
                  </div>
                  <div className="text-xs text-blue-700 mt-1">
                    With parallel execution (3 brands): ~
                    {Math.ceil((breakdown.total * 37) / 60 / 1.7)} minutes
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* Warning if no prompts */}
      {selectedClientIds.length > 0 && breakdown.total === 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="text-sm text-yellow-800">
              ⚠️ No prompts match your selection. Please adjust your filters or selection type.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
