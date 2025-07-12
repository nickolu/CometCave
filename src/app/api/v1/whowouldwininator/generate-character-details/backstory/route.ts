export async function POST(request: Request) {
  const { name, description } = await request.json();
  const character = generateCharacter(name, description);
  return NextResponse.json({ character });
}