'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, BookOpen, TrendingUp, Brain } from 'lucide-react';

export default function CitationIntentPage() {
  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-gray-900">Citation Intent Analysis</h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          Understand the "why" behind citations in your knowledge graph
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Brain className="h-6 w-6 text-blue-600" />
            How It Works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center space-y-3">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                <Target className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="font-semibold">1. Extract Context</h3>
              <p className="text-sm text-gray-600">
                GROBID extracts full text and identifies citation contexts
              </p>
            </div>
            
            <div className="text-center space-y-3">
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                <Brain className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="font-semibold">2. AI Analysis</h3>
              <p className="text-sm text-gray-600">
                AI analyzes context to classify citation intent
              </p>
            </div>
            
            <div className="text-center space-y-3">
              <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                <Target className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="font-semibold">3. Research Insights</h3>
              <p className="text-sm text-gray-600">
                Identify research gaps and opportunities
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Citation Intent Types</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="border rounded-lg p-4 bg-green-50 border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-5 w-5 text-green-600" />
                <h4 className="font-semibold text-green-800">Motivation</h4>
              </div>
              <p className="text-sm text-green-700">
                Identifies problems or research gaps. <strong>Most important!</strong>
              </p>
            </div>
            
            <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="h-5 w-5 text-blue-600" />
                <h4 className="font-semibold text-blue-800">Background</h4>
              </div>
              <p className="text-sm text-blue-700">
                Provides foundational knowledge and context
              </p>
            </div>
            
            <div className="border rounded-lg p-4 bg-purple-50 border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-purple-600" />
                <h4 className="font-semibold text-purple-800">Extension</h4>
              </div>
              <p className="text-sm text-purple-700">
                Extends or improves previous approaches
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
