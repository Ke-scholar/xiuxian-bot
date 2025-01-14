import { plugin, type AEvent } from 'alemonjs'
import { isThereAUserPresent, DB, GameApi, sendReply } from '../../api/index.js'
export class AssManage extends plugin {
  constructor() {
    super({
      rule: [
        {
          reg: /^(#|\/)?审核[\u4e00-\u9fa5]+$/,
          fnc: 'ruleAss'
        },
        {
          reg: /^(#|\/)?通过\d+$/,
          fnc: 'decisionAss'
        },
        {
          reg: /^(#|\/)?踢出\d+$/,
          fnc: 'dismissAss'
        },
        {
          reg: /^(#|\/)?扩建$/,
          fnc: 'improreAss'
        },
        {
          reg: /^(#|\/)?扩建宝库$/,
          fnc: 'improreAssTreasure'
        },
        {
          reg: /^(#|\/)?提拔\d+$/,
          fnc: 'promoteAss'
        },
        {
          reg: /^(#|\/)?贬职$/,
          fnc: 'demotionAss'
        }
      ]
    })
  }

  /**
   * 审核
   * @param e
   * @returns
   */
  async ruleAss(e: AEvent) {
    const UID = e.user_id
    if (!(await isThereAUserPresent(e, UID))) return
    const name = e.msg.replace(/^(#|\/)?审核/, '')
    const v = await GameApi.Ass.v(UID, name)
    if (v === false) return
    if (v === '权能不足') {
      e.reply(v)
      return
    }

    const { aData } = v

    const uData: DB.UserAssType[] = (await DB.user_ass.findAll({
      where: {
        aid: aData.id,
        identity: GameApi.Config.ASS_IDENTITY_MAP['9']
      },
      include: [
        {
          model: DB.user
        }
      ],
      raw: true
    })) as any

    if (!uData || uData.length == 0) {
      e.reply('暂无申请')
      return
    }

    const msg = []

    for (const item of uData) {
      msg.push(
        `\n标记:${item.id}_编号:${item['user.uid']}\n昵称:${item['user.name']}`
      )
    }

    sendReply(e, `[${aData.name}名录]`, msg)
    return
  }

  /**
   * 通过
   * @param e
   * @returns
   */
  async decisionAss(e: AEvent) {
    const UID = e.user_id
    if (!(await isThereAUserPresent(e, UID))) return

    const id = Number(e.msg.replace(/^(#|\/)?通过/, ''))

    if (!id) return

    const uData: DB.UserAssType = (await DB.user_ass.findOne({
      where: {
        id: Number(id),
        identity: GameApi.Config.ASS_IDENTITY_MAP['9']
      },
      include: [
        {
          model: DB.ass
        }
      ],
      raw: true
    })) as any

    // 不存在该条目
    if (!uData) return

    const v = await GameApi.Ass.v(UID, uData['ass.name'])
    if (v === false) return
    if (v === '权能不足') {
      e.reply(v)
      return
    }

    const { aData } = v

    const data: DB.UserAssType[] = (await DB.user_ass.findAll({
      where: {
        aid: aData.id,
        identity: { [DB.Op.ne]: GameApi.Config.ASS_IDENTITY_MAP['9'] }
      },
      raw: true
    })) as any

    if (data.length >= (aData.grade + 1) * 5) {
      e.reply('人数已达上限', {
        quote: e.msg_id
      })
      return
    }

    await DB.user_ass
      .update(
        {
          identity: GameApi.Config.ASS_IDENTITY_MAP['8']
        } as DB.UserAssType,
        {
          where: {
            id: Number(id)
          }
        }
      )
      .then(() => {
        e.reply('审核通过', {
          quote: e.msg_id
        })
      })
      .catch(() => {
        e.reply('审核失败', {
          quote: e.msg_id
        })
      })

    return
  }

  /**
   * 踢出
   * @param e
   */
  async dismissAss(e: AEvent) {
    const UID = e.user_id
    if (!(await isThereAUserPresent(e, UID))) return
    const id = Number(e.msg.replace(/^(#|\/)?踢出/, ''))
    if (!id) return
    const uData: DB.UserAssType = (await DB.user_ass.findOne({
      where: {
        id: Number(id)
      },
      include: [
        {
          model: DB.ass
        }
      ],
      raw: true
    })) as any

    // 不存在该条目
    if (!uData) return

    const v = await GameApi.Ass.v(UID, uData['ass.name'])
    if (v === false) return
    if (v === '权能不足') {
      e.reply(v)
      return
    }
    const { UserAss } = v

    if (uData.authentication <= UserAss.authentication) {
      e.reply('权能过低')
      return
    }

    await DB.user_ass
      .destroy({
        where: {
          id: Number(id)
        }
      })
      .then(() => {
        e.reply('踢出成功', {
          quote: e.msg_id
        })
      })
      .catch(() => {
        e.reply('踢出失败', {
          quote: e.msg_id
        })
      })

    return
  }

  /**
   * 升级
   * @param e
   */
  async improreAss(e: AEvent) {
    const UID = e.user_id
    if (!(await isThereAUserPresent(e, UID))) return
    const UIDData: DB.UserAssType = (await DB.user_ass.findOne({
      where: {
        id: Number(UID)
      },
      include: [
        {
          model: DB.ass
        }
      ],
      raw: true
    })) as any
    const v = await GameApi.Ass.v(UID, UIDData['ass.name'])
    if (v === false) return
    if (v === '权能不足') {
      e.reply(v)
      return
    }
    const goods = await GameApi.Bag.searchBagByName(UID, '开天令')
    const num = GameApi.Cooling.upgradeass[UIDData['ass.grade']]
    if (!goods) return e.reply('你没有开天令')
    if (goods.acount < num) return e.reply('开天令不足')
    GameApi.Bag.reduceBagThing(UID, [{ name: '开天令', acount: num }])
    await DB.ass.update(
      { grade: UIDData['ass.grade'] },
      {
        where: {
          id: Number(UID)
        }
      }
    )

    return
  }

  /**
   * 升级宝库
   * @param e
   */
  async improreAssTreasure(e: AEvent) {
    const UID = e.user_id
    if (!(await isThereAUserPresent(e, UID))) return
    const UIDData: DB.UserAssType = (await DB.user_ass.findOne({
      where: {
        id: Number(UID)
      },
      include: [
        {
          model: DB.ass
        }
      ],
      raw: true
    })) as any
    const v = await GameApi.Ass.v(UID, UIDData['ass.name'])
    if (v === false) return
    if (v === '权能不足') {
      e.reply(v)
      return
    }
    const goods = await GameApi.Bag.searchBagByName(UID, '开天令')
    const num = GameApi.Cooling.upgradeass[UIDData['ass.grade']]
    if (!goods) return e.reply('你没有开天令')
    if (goods.acount < num) return e.reply('开天令不足')
    GameApi.Bag.reduceBagThing(UID, [{ name: '开天令', acount: num }])
    await DB.ass
      .update(
        { property: GameApi.Cooling.MAXpropety[UIDData['ass.bag_grade']] },
        {
          where: {
            id: Number(UID)
          }
        }
      )
      .then(() => {
        e.reply('升级完成', {
          quote: e.msg_id
        })
      })
      .catch(() => {
        e.reply('升级失败', {
          quote: e.msg_id
        })
      })
    return
  }
  /**
   * 提拔
   * @param e
   */
  async promoteAss(e: AEvent) {
    const UID = e.user_id
    if (!(await isThereAUserPresent(e, UID))) return
    const id = Number(e.msg.replace(/^(#|\/)?提拔/, ''))
    if (!id) return
    const uData: DB.UserAssType = (await DB.user_ass.findOne({
      where: {
        id: Number(id)
      },
      include: [
        {
          model: DB.ass
        }
      ],
      raw: true
    })) as any
    // 不存在该玩家
    if (!uData) return
    if (!uData.authentication) return e.reply('权能已达最高')
    const v = await GameApi.Ass.v(UID, uData['ass.name'])
    if (v === false) return
    if (v === '权能不足') {
      e.reply(v)
      return
    }
    const { UserAss } = v
    if (uData.authentication <= UserAss.authentication) {
      e.reply('权能过低')
      return
    }
    uData.authentication -= 1
    await DB.user_ass
      .update(uData, {
        where: {
          id: Number(id)
        }
      })
      .then(() => {
        e.reply('提拔成功', {
          quote: e.msg_id
        })
      })
      .catch(() => {
        e.reply('提拔失败', {
          quote: e.msg_id
        })
      })

    return
  }
  /**
   * 贬职
   * @param e
   */
  async demotionAss(e: AEvent) {
    const UID = e.user_id
    if (!(await isThereAUserPresent(e, UID))) return
    const id = Number(e.msg.replace(/^(#|\/)?提拔/, ''))
    if (!id) return
    const uData: DB.UserAssType = (await DB.user_ass.findOne({
      where: {
        id: Number(id)
      },
      include: [
        {
          model: DB.ass
        }
      ],
      raw: true
    })) as any
    // 不存在该玩家
    if (!uData) return
    if (uData.authentication == 9) return e.reply('权能已达最低')
    const v = await GameApi.Ass.v(UID, uData['ass.name'])
    if (v === false) return
    if (v === '权能不足') {
      e.reply(v)
      return
    }
    const { UserAss } = v
    if (uData.authentication <= UserAss.authentication) {
      e.reply('权能过低')
      return
    }
    uData.authentication += 1
    await DB.user_ass
      .update(uData, {
        where: {
          id: Number(id)
        }
      })
      .then(() => {
        e.reply('贬值成功', {
          quote: e.msg_id
        })
      })
      .catch(() => {
        e.reply('贬值失败', {
          quote: e.msg_id
        })
      })

    return
  }
}
