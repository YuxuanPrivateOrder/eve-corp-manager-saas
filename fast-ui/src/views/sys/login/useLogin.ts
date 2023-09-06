import type {FormInstance} from 'ant-design-vue/lib/form/Form';
import type {RuleObject, NamePath} from 'ant-design-vue/lib/form/interface';
import {ref, computed, unref, Ref} from 'vue';
import {useI18n} from '/@/hooks/web/useI18n';
import {isPhone} from "@/utils/is";
import {checkFieldExist} from "@/api/sys/user";

export enum LoginStateEnum {
    LOGIN,
    REGISTER,
    RESET_PASSWORD,
    MOBILE,
    QR_CODE,
}

const currentState = ref(LoginStateEnum.LOGIN);

// 这里也可以优化
// import { createGlobalState } from '@vueuse/core'

export function useLoginState() {
    function setLoginState(state: LoginStateEnum) {
        currentState.value = state;
    }

    const getLoginState = computed(() => currentState.value);

    function handleBackLogin() {
        setLoginState(LoginStateEnum.LOGIN);
    }

    return {setLoginState, getLoginState, handleBackLogin};
}

export function useFormValid<T extends Object = any>(formRef: Ref<FormInstance>) {
    const validate = computed(() => {
        const form = unref(formRef);
        return form?.validate ?? ((_nameList?: NamePath) => Promise.resolve());
    });

    async function validForm() {
        const form = unref(formRef);
        if (!form) return;
        const data = await form.validate();
        return data as T;
    }

    return {validate, validForm};
}

export function useFormRules(formData?: Recordable) {
    const {t} = useI18n();

    const getAccountFormRule = computed(() => createRule(t('sys.login.accountPlaceholder')));
    const getPasswordFormRule = computed(() => createRule(t('sys.login.passwordPlaceholder')));
    const getSmsFormRule = computed(() => createRule(t('sys.login.smsPlaceholder')));
    const getImgCodeRule = computed(() => createRule('请输入图片验证码'))
    //const getMobileFormRule = computed(() => createRule(t('sys.login.mobilePlaceholder')));

    const validatePolicy = async (_: RuleObject, value: boolean) => {
        return !value ? Promise.reject(t('sys.login.policyPlaceholder')) : Promise.resolve();
    };

    const validateConfirmPassword = (password: string) => {
        return async (_: RuleObject, value: string) => {
            if (!value) {
                return Promise.reject(t('sys.login.passwordPlaceholder'));
            }
            if (value !== password) {
                return Promise.reject(t('sys.login.diffPwd'));
            }
            return Promise.resolve();
        };
    };

    const getFormRules = computed((): { [k: string]: any | any[] } => {
        const accountFormRule = unref(getAccountFormRule);
        const passwordFormRule = unref(getPasswordFormRule);
        const smsFormRule = unref(getSmsFormRule);
        // const mobileFormRule = unref(getMobileFormRule);
        const imgCodeRule = unref(getImgCodeRule)
        const mobileRule = {
            sms: smsFormRule,
            imgCode: imgCodeRule,
            mobile: [
                {
                    validator(_, value) {
                        return new Promise((resolve, reject) => {
                            if (!value) {
                                reject('请输入正确的手机号')
                                return
                            }
                            if (value && !isPhone(value)) {
                                reject('请输入正确的手机号')
                                return
                            }

                            resolve('')
                        })
                    },
                }
            ],
        };
        switch (unref(currentState)) {
            // register form rules
            case LoginStateEnum.REGISTER:
                return {
                    account: [
                        {
                            validator(_, value) {
                                return new Promise((resolve, reject) => {
                                    if (!value) {
                                        reject('请输入账号')
                                        return
                                    }
                                    checkFieldExist('username', value).then(r => !r ? resolve('') : reject('账号已存在'));
                                })
                            },
                        }
                    ],
                    password: passwordFormRule,
                    confirmPassword: [
                        {validator: validateConfirmPassword(formData?.password), trigger: 'change'},
                    ],
                    policy: [{validator: validatePolicy, trigger: 'change'}],
                    ...mobileRule,
                };

            // reset password form rules
            case LoginStateEnum.RESET_PASSWORD:
                return {
                    ...mobileRule,
                    password: passwordFormRule,
                    confirmPassword: [
                        {validator: validateConfirmPassword(formData?.password), trigger: 'change'},
                    ],
                };

            // mobile form rules
            case LoginStateEnum.MOBILE:
                return mobileRule;

            // login form rules
            default:
                return {
                    account: accountFormRule,
                    password: passwordFormRule,
                };
        }
    });
    return {getFormRules};
}

function createRule(message: string) {
    return [
        {
            required: true,
            message,
            trigger: 'change',
        },
    ];
}
