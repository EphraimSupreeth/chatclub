import { createClient } from '@supabase/supabase-js'
import { AccessToken } from 'livekit-server-sdk'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const liveKitUrl = Deno.env.get('LIVEKIT_URL') ?? ''
const liveKitApiKey = Deno.env.get('LIVEKIT_API_KEY') ?? ''
const liveKitApiSecret = Deno.env.get('LIVEKIT_API_SECRET') ?? ''
const appOrigin = Deno.env.get('APP_ORIGIN') ?? ''

function corsHeaders(request: Request) {
  const origin = request.headers.get('origin') ?? ''
  const allowedOrigin =
    origin === appOrigin || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
      ? origin
      : appOrigin

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

function response(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(request) })
  }
  if (request.method !== 'POST') {
    return response(request, { error: 'Method not allowed' }, 405)
  }
  if (
    !supabaseUrl ||
    !anonKey ||
    !serviceRoleKey ||
    !liveKitUrl ||
    !liveKitApiKey ||
    !liveKitApiSecret ||
    !appOrigin
  ) {
    return response(request, { error: 'Calling service is not configured' }, 503)
  }

  try {
    const authorization = request.headers.get('Authorization')
    if (!authorization) return response(request, { error: 'Authentication required' }, 401)

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    })
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser()
    if (userError || !user) {
      return response(request, { error: 'Authentication required' }, 401)
    }

    const { classroomId, peerUserId, callId } = await request.json()
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (
      !uuidPattern.test(classroomId) ||
      !uuidPattern.test(peerUserId) ||
      typeof callId !== 'string' ||
      !/^[a-zA-Z0-9-]{8,80}$/.test(callId) ||
      peerUserId === user.id
    ) {
      return response(request, { error: 'Invalid call request' }, 400)
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })
    const [{ data: members, error: membersError }, { data: blocks, error: blocksError }] =
      await Promise.all([
        admin
          .from('classroom_members')
          .select('user_id')
          .eq('classroom_id', classroomId)
          .in('user_id', [user.id, peerUserId]),
        admin
          .from('member_blocks')
          .select('user_id')
          .eq('classroom_id', classroomId)
          .or(
            `and(user_id.eq.${user.id},blocked_user_id.eq.${peerUserId}),` +
              `and(user_id.eq.${peerUserId},blocked_user_id.eq.${user.id})`,
          ),
      ])

    if (membersError || blocksError) throw membersError ?? blocksError
    if (members?.length !== 2) {
      return response(request, { error: 'Both users must be classroom members' }, 403)
    }
    if (blocks?.length) {
      return response(request, { error: 'Calling is unavailable for this conversation' }, 403)
    }

    const participantPair = [user.id, peerUserId].sort().join('-')
    const roomName = `chatclub-${classroomId}-${participantPair}-${callId}`
    const accessToken = new AccessToken(liveKitApiKey, liveKitApiSecret, {
      identity: user.id,
      ttl: '10m',
    })
    accessToken.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: false,
      roomAdmin: false,
      roomRecord: false,
    })

    return response(request, {
      token: await accessToken.toJwt(),
      url: liveKitUrl,
    })
  } catch (error) {
    console.error('livekit-token failed', error)
    return response(request, { error: 'Unable to authorize this call' }, 500)
  }
})
