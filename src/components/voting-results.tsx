'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import type { Vote, Voter } from '../types/voting';

interface VotingResultsProps {
  votes: Vote[];
  voters: Voter[];
  onRestart: () => void;
}

export default function VotingResults({ votes, voters, onRestart }: VotingResultsProps) {
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
          votes: voterVotes,
          distribution: groupDistribution,
          total: voterVotes.length,
        };
        return acc;
      },
      {} as Record<string, { votes: Vote[]; distribution: Record<string, number>; total: number }>
    );

    return { distribution, groupResults };
  }, [votes, voters]);

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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h2 className="text-xl font-bold mb-2">Vote Distribution</h2>
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
              <h2 className="text-xl font-bold mb-2">Vote Percentages</h2>
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
            <h2 className="text-xl font-bold mb-2">Summary Statistics</h2>
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

        <TabsContent value="groups" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(results.groupResults).map(([groupName, groupData]) => (
              <div key={groupName}>
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
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="individual" className="space-y-4">
          <div>
            <h2 className="text-xl font-bold mb-2">Individual Voter Details</h2>
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

        <TabsContent value="analysis" className="space-y-4">
          <div>
            <h2 className="text-xl font-bold mb-2">AI-Generated Analysis</h2>
            <div>
              <div className="space-y-4">
                {Object.entries(results.groupResults).map(([groupName, groupData]) => (
                  <div key={groupName} className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">{groupName} Group Analysis</h4>
                    <p className="text-sm text-gray-600 mb-2">
                      This group cast {groupData.total} votes with the following pattern:
                    </p>
                    <ul className="text-sm space-y-1">
                      {Object.entries(groupData.distribution).map(([option, count]) => (
                        <li key={option}>
                          • {option}: {count} votes ({((count / groupData.total) * 100).toFixed(1)}
                          %)
                        </li>
                      ))}
                    </ul>
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
