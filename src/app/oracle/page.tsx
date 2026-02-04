'use client'

import { AnimatePresence } from "framer-motion"
import { useState } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Typography } from "@/components/ui/typography"

import { BuildHexagramManually } from "./build-hexagram"
import { TransitionWrapper } from "./components/ui/transition-wrapper"
import { GenerateHexagram } from "./generate-hexagram"

const SelectHexagramMethod = () => {
    const [hexagramMethod, setHexagramMethod] = useState<'generate' | 'build' | null>(null)


    return (
        <AnimatePresence mode="wait">
            {!hexagramMethod && (
                <TransitionWrapper>
                    <Typography variant="h2">Select Hexagram Method</Typography>
                    <div className="flex gap-2">
                        <Card className="cursor-pointer hover:bg-accent hover:shadow-md hover:translate-y-[1px]" onClick={() => setHexagramMethod('generate')}>
                            <CardHeader>
                                <CardTitle>Generate with Divination</CardTitle>
                            </CardHeader>
                            <CardContent>
                                [IMG Goes Here]
                            </CardContent>
                        </Card>
                        <Card className="cursor-pointer hover:bg-accent hover:shadow-md hover:translate-y-[1px]" onClick={() => setHexagramMethod('build')}>
                            <CardHeader>
                                <CardTitle>Enter Hexagram Manually</CardTitle>
                            </CardHeader>
                            <CardContent>
                                [IMG Goes Here]
                            </CardContent>
                        </Card>
                    </div>
                </TransitionWrapper>
            )}

            {hexagramMethod === 'generate' && (
                <TransitionWrapper>
                    <GenerateHexagram setHexagramMethod={setHexagramMethod} />
                </TransitionWrapper>
            )}

            {hexagramMethod === 'build' && (
                <TransitionWrapper>
                    <BuildHexagramManually setHexagramMethod={setHexagramMethod} />
                </TransitionWrapper>
            )}
        </AnimatePresence>
    )
}


const OraclePage = () => {
    return <div className="flex flex-col gap-4 text-center pt-10">
        <Typography variant="h1">Ask the Oracle</Typography>
        <p>Enter any question and get an answer from the Oracle using the I Ching.</p>
        <div className="flex flex-col gap-4 text-center items-center justify-center mt-10"><SelectHexagramMethod /></div>
    </div>
}

export default OraclePage