'use client';

import { useMemo, useState, useEffect } from 'react';
import { Button } from '@/app/voters/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/voters/components/ui/tabs';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import type { Vote, Voter, VotingCriteria } from '@/app/voters/types/voting';
import { useGenerateSummary } from '../api/hooks';

interface VotingResultsProps {
  votes: Vote[];
  voters: Voter[];
  criteria?: VotingCriteria;
  onRestart: () => void;
}

export default function VotingResults({ votes, voters, criteria, onRestart }: VotingResultsProps) {
  const [groupSummaries, setGroupSummaries] = useState<Record<string, string>>({});
  const [loadingSummaries, setLoadingSummaries] = useState<string[]>([]);

  const generateSummaryMutation = useGenerateSummary();

  const results = useMemo(() => {
    const distribution = votes.reduce(
      (acc, vote) => {
        acc[vote.choice] = (acc[vote.choice] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const groupResults = voters.reduce(
      (acc, voter) => {
        const voterVotes = votes.filter(v => v.voterName === voter.name);
        const groupDistribution = voterVotes.reduce(
          (dist, vote) => {
            dist[vote.choice] = (dist[vote.choice] || 0) + 1;
            return dist;
          },
          {} as Record<string, number>
        );

        acc[voter.name] = {
          voter,
          votes: voterVotes,
          distribution: groupDistribution,
          total: voterVotes.length,
        };
        return acc;
      },
      {} as Record<
        string,
        { voter: Voter; votes: Vote[]; distribution: Record<string, number>; total: number }
      >
    );

    return { distribution, groupResults };
  }, [votes, voters]);

  // Generate summaries for groups with more than 5 votes
  useEffect(() => {
    const generateSummariesForLargeGroups = async () => {
      if (!criteria) return;

      const groupsNeedingSummary = Object.entries(results.groupResults).filter(
        ([groupName, groupData]) =>
          groupData.total > 5 && !groupSummaries[groupName] && !loadingSummaries.includes(groupName)
      );

      if (groupsNeedingSummary.length === 0) return;

      for (const [groupName, groupData] of groupsNeedingSummary) {
        setLoadingSummaries(prev => [...prev, groupName]);

        generateSummaryMutation.mutate(
          {
            voterGroup: groupData.voter,
            votes: groupData.votes,
            criteria,
          },
          {
            onSuccess: data => {
              setGroupSummaries(prev => ({ ...prev, [groupName]: data.summary }));
              setLoadingSummaries(prev => prev.filter(name => name !== groupName));
            },
            onError: error => {
              console.error(`Error generating summary for ${groupName}:`, error);
              setLoadingSummaries(prev => prev.filter(name => name !== groupName));
            },
          }
        );
      }
    };

    generateSummariesForLargeGroups();
  }, [results.groupResults, criteria, groupSummaries, loadingSummaries]);

  const chartData = Object.entries(results.distribution).map(([option, count]) => ({
    option,
    count,
    percentage: ((count / votes.length) * 100).toFixed(1),
  }));

  const pieData = chartData.map((item, index) => ({
    ...item,
    fill: `hsl(${(index * 137.5) % 360}, 70%, 50%)`,
  }));

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Voting Results</h2>
        <p className="text-gray-600">
          Analysis of {votes.length} votes from {voters.length} voter groups
        </p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="groups">By Group</TabsTrigger>
          <TabsTrigger value="individual">Individual Votes</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4">
            <div>
              <h2 className="text-xl font-bold mb-4">Vote Distribution</h2>
              <div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="option" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-bold mb-4">Vote Percentages</h2>
              <div>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ option, percentage }) => `${option}: ${percentage}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold mb-4">Summary Statistics</h2>
            <div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {chartData.map(item => (
                  <div key={item.option} className="text-center p-4 border rounded-lg">
                    <p className="text-2xl font-bold">{item.count}</p>
                    <p className="text-sm text-gray-600">{item.option}</p>
                    <p className="text-xs text-gray-500">{item.percentage}%</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="groups" className="space-y-4 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(results.groupResults).map(([groupName, groupData]) => (
              <div key={groupName} className="border rounded-lg p-4">
                <h2 className="text-lg font-bold mb-2">{groupName}</h2>
                <div>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">Total votes: {groupData.total}</p>
                    {Object.entries(groupData.distribution).map(([option, count]) => (
                      <div key={option} className="flex justify-between">
                        <span className="text-sm">{option}</span>
                        <span className="text-sm font-medium">
                          {count} ({((count / groupData.total) * 100).toFixed(1)}%)
                        </span>
                      </div>
                    ))}

                    {/* Summary for groups with more than 5 votes */}
                    {groupData.total > 5 && (
                      <div className="mt-4 pt-3 border-t border-gray-200">
                        <h4 className="text-sm font-semibold mb-2 text-blue-600">
                          AI Summary ({groupData.total} votes):
                        </h4>
                        {loadingSummaries.includes(groupName) ? (
                          <div className="flex items-center space-x-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                            <span className="text-xs text-gray-500">Generating summary...</span>
                          </div>
                        ) : groupSummaries[groupName] ? (
                          <p className="text-xs text-gray-500 leading-relaxed">
                            {groupSummaries[groupName]}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-500 italic">
                            Summary will be generated shortly...
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="individual" className="space-y-4 p-4">
          <div>
            <h2 className="text-xl font-bold mb-4">Individual Voter Details</h2>
            <div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Voter</th>
                      <th className="text-left p-2">Choice</th>
                      <th className="text-left p-2">Reasoning</th>
                    </tr>
                  </thead>
                  <tbody>
                    {votes.map((vote, index) => (
                      <tr key={index} className="border-b">
                        <td className="p-2">
                          <div>
                            <p className="font-medium">{vote.voterName}</p>
                            <p className="text-xs text-gray-500">{vote.instanceId}</p>
                          </div>
                        </td>
                        <td className="p-2 font-medium">{vote.choice}</td>
                        <td className="p-2 text-xs">{vote.reasoning}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-4 p-4">
          <div>
            <h2 className="text-xl font-bold mb-4">Voting Analysis</h2>
            <div>
              <div className="space-y-4">
                {Object.entries(results.groupResults).map(([groupName, groupData]) => (
                  <div key={groupName} className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">{groupName} Group Analysis</h4>
                    <p className="text-sm text-gray-600 mb-2">
                      This group cast {groupData.total} votes with the following pattern:
                    </p>
                    <ul className="text-sm space-y-1 mb-3">
                      {Object.entries(groupData.distribution).map(([option, count]) => (
                        <li key={option}>
                          • {option}: {count} votes ({((count / groupData.total) * 100).toFixed(1)}
                          %)
                        </li>
                      ))}
                    </ul>

                    {/* Enhanced analysis with AI summary for large groups */}
                    {groupData.total > 5 && (
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <h5 className="text-sm font-semibold mb-2 text-blue-800">
                          Detailed Insights:
                        </h5>
                        {loadingSummaries.includes(groupName) ? (
                          <div className="flex items-center space-x-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                            <span className="text-xs text-gray-600">
                              Analyzing voting patterns...
                            </span>
                          </div>
                        ) : groupSummaries[groupName] ? (
                          <p className="text-sm text-blue-700">{groupSummaries[groupName]}</p>
                        ) : (
                          <p className="text-xs text-blue-600 italic">
                            Advanced analysis in progress...
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-center">
        <Button onClick={onRestart} size="lg">
          Start New Voting Session
        </Button>
      </div>
    </div>
  );
}
